import pino from "pino";
import { createScrapeHandle, createNotifier } from "./setup.js";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

try {
  const handle = await createScrapeHandle(logger);
  const newListings = await handle.run();
  if (newListings.length > 0) {
    const notifier = createNotifier(logger);
    await notifier.notify(newListings);
  }
} catch (error) {
  logger.error({ err: error }, "Error running scrape handler");
}
