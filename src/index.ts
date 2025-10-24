import pino from "pino";
import { createScrapeHandle, createNotifier, IS_FARGATE } from "./setup.js";
import { Config } from "./core/config/config.js";
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

try {
  const config = await Config.getConfig();
  const handle = await createScrapeHandle(config, logger);
  const newListings = await handle.run();
  if (newListings.length > 0) {
    logger.info(
      { newListings: newListings.length },
      "New listings found! Sending notification via SES.",
    );
    const notifier = createNotifier(config, logger);
    await notifier.notify(newListings);
  } else {
    logger.info("No new listings found.");
  }
} catch (error) {
  logger.error({ err: error }, "Error running scrape handler");
  throw error;
}
