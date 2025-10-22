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
import { ScrapeHandle, ScrapeOptions } from "./core/scrape.js";
import { Logger } from "pino";
import { LocalNotifier, SESNotifier } from "./core/notify/index.js";
import isDocker from "is-docker";
import { LaunchOptions } from "playwright";

export const IS_FARGATE = !!process.env.AWS_EXECUTION_ENV;
export const IS_DOCKER = isDocker();

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

  const scrapeOptions: ScrapeOptions = {
    logger,
    sites,
    storage,
    browserOptions: { headless: true },
  };

  if (IS_DOCKER) {
    scrapeOptions.browserOptions!.args = [
      "--no-sandbox", // Required: sandboxing doesn't work in Fargate
      "--disable-setuid-sandbox", // Disable setuid helper; redundant but safe
      "--disable-dev-shm-usage", // Use /tmp instead of /dev/shm to avoid small SHM crashes
      "--disable-gpu", // No GPU on Fargate; prevents GL errors
    ];
    scrapeOptions.concurrency = 3;
  }

  return ScrapeHandle.create(scrapeOptions);
}
