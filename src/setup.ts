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
import { Logger } from "pino";
import { LocalNotifier, SESNotifier } from "./core/notify/index.js";

export const IS_FARGATE = !!process.env.AWS_EXECUTION_ENV;

export async function createStorageAdapter(logger: Logger) {
  return IS_FARGATE
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
  return IS_FARGATE
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
    // new Enlign(),
    // new TheCBAGroup(),
    // new VRBusinessBrokers(),
    // new FCBB(),
    // new VikingMergers(),
    // new BeaconAdvisors(),
    // new Midstreet(),
    // new BAMA(),
    // new MorganWestfield(),
  ];

  const storage = await createStorageAdapter(logger);

  return ScrapeHandle.create({
    logger,
    sites,
    storage,
  });
}
