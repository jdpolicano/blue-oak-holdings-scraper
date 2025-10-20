import {
  TheDynastyBA,
  TheCBAGroup,
  Enlign,
  VRBusinessBrokers,
  FCBB,
  VikingMergers,
  BeaconAdvisors,
  Midstreet,
  BAMA,
  MorganWestfield,
} from "./adapters/index.js";
import { MemoryStorage, S3StorageStreamed } from "./core/storage/index.js";
import { ScrapeHandle } from "./core/scrape.js";
import awsChromium from "@sparticuz/chromium";
import { Logger } from "pino";
import { LocalNotifier, SESNotifier } from "./core/notify/index.js";

export const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function createStorageAdapter(logger: Logger) {
  return IS_LAMBDA
    ? S3StorageStreamed.create(
        process.env.S3_BUCKET_NAME!,
        process.env.S3_OBJECT_KEY!,
        logger.child({ component: S3StorageStreamed.name }),
      )
    : MemoryStorage.create(
        "listings.csv",
        logger.child({ component: MemoryStorage.name }),
      );
}

export function createNotifier(logger: Logger) {
  return IS_LAMBDA
    ? new SESNotifier(
        process.env.SES_FROM_ADDRESS!,
        process.env.SES_TO_ADDRESSES!.split(","),
        logger.child({ component: SESNotifier.name }),
      )
    : new LocalNotifier(logger.child({ component: LocalNotifier.name }));
}

export async function createScrapeHandle(logger: Logger) {
  const sites = [
    new TheDynastyBA(),
    new Enlign(),
    new TheCBAGroup(),
    new VRBusinessBrokers(),
    new FCBB(),
    new VikingMergers(),
    new BeaconAdvisors(),
    new Midstreet(),
    new BAMA(),
    new MorganWestfield(),
  ];

  const storage = await createStorageAdapter(logger);

  return IS_LAMBDA
    ? ScrapeHandle.create({
        logger: logger.child({ component: ScrapeHandle.name }),
        sites,
        browserOptions: {
          args: awsChromium.args,
          executablePath: await awsChromium.executablePath(),
        },
        storage,
      })
    : ScrapeHandle.create({
        logger,
        sites,
        storage,
      });
}
