import { registry } from "./adapters/index.js";
import { MemoryStorage, S3StorageStreamed } from "./core/storage/index.js";
import { ScrapeHandle, ScrapeOptions } from "./core/scrape.js";
import { Logger } from "pino";
import { LocalNotifier, SESNotifier } from "./core/notify/index.js";
import isDocker from "is-docker";
import { Config } from "./core/config/config.js";

export const IS_FARGATE = !!process.env.AWS_EXECUTION_ENV;
export const IS_DOCKER = isDocker();

export async function createStorageAdapter(config: Config, logger: Logger) {
  if (config.get("dryRun")) {
    logger.info(
      { plan: config.get("dataSources") },
      "createStorageAdapter dryRun requested",
    );
    return MemoryStorage.create(
      "listings.csv",
      logger.child({ component: MemoryStorage.name }),
    );
  }
  const { config: dataSourceConfig } = config.get("dataSources");
  return S3StorageStreamed.create(
    dataSourceConfig.bucket,
    dataSourceConfig.dataKey,
    logger.child({ component: S3StorageStreamed.name }),
  );
}

export function createNotifier(config: Config, logger: Logger) {
  if (config.get("dryRun")) {
    logger.info(
      { plan: config.get("notifications") },
      "createNotifierAdapter dryRun requested",
    );
    return new LocalNotifier(logger.child({ component: LocalNotifier.name }));
  }
  const { config: notificationsConfig } = config.get("notifications");
  const allRecipiants = notificationsConfig.to.concat([
    notificationsConfig.admin,
  ]);
  const recipiantsUnique = Array.from(new Set(allRecipiants));
  return new SESNotifier(
    notificationsConfig.sender,
    recipiantsUnique,
    logger.child({ component: SESNotifier.name }),
  );
}

export async function createScrapeHandle(config: Config, logger: Logger) {
  const { sites, browserOptions } = config.get("scraperOptions");
  const regSites = sites.length ? registry.list(sites) : registry.all();
  const storage = await createStorageAdapter(config, logger);
  const handleConfig: ScrapeOptions = {
    logger,
    storage,
    sites: regSites,
    browserOptions,
  };
  return ScrapeHandle.create(handleConfig);
}
