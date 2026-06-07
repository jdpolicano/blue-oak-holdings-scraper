import pino from "pino";
import { createScrapeHandle, createNotifier, IS_FARGATE } from "./setup.js";
import { Config } from "./core/config/config.js";
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

try {
  const config = await Config.getConfig();
  const handle = await createScrapeHandle(config, logger);
  const notifier = createNotifier(config, logger);
  const scrapeResult = await handle.run();
  
  // Send listing notifications if new listings found
  if (scrapeResult.listings.length > 0) {
    logger.info(
      { newListings: scrapeResult.listings.length },
      "New listings found! Sending notification via SES.",
    );
    await notifier.notify(scrapeResult.listings);
  } else {
    logger.info("No new listings found.");
  }
  
  // Send scraping error notifications if any errors occurred
  if (scrapeResult.errors.length > 0) {
    logger.warn(
      { 
        errors: scrapeResult.errors.length,
        affectedSites: [...new Set(scrapeResult.errors.map(e => e.site))].length 
      },
      "Scraping errors detected! Sending error notification via SES.",
    );
    await notifier.notifyScrapingErrors(scrapeResult.errors);
  } else {
    logger.info("No scraping errors detected.");
  }
} catch (error) {
  logger.error({ err: error }, "Error running scrape handler");
  throw error;
}
