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
import { MemoryStorage } from "./core/storage/index.js";
import { ScrapeHandle } from "./core/scrape.js";
import awsChromium from "@sparticuz/chromium";
import { Logger } from "pino";
import { LocalNotifier, SESNotifier } from "./core/notify/index.js";

export const IS_LAMDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function createStorageAdapter(logger: Logger) {
  const storage = await MemoryStorage.create(
    "listings.csv",
    logger.child({ component: MemoryStorage.name }),
  );
  return storage;
}

export function createNotifier(logger: Logger) {
  return IS_LAMDA
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

  return IS_LAMDA
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
