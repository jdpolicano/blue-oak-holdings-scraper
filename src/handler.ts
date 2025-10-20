import pino from "pino";
import { createScrapeHandle, createNotifier, IS_LAMDA } from "./setup.js";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export const handler = async (_: unknown) => {
  const handle = await createScrapeHandle(logger);
  const newListings = await handle.run();
  if (newListings.length > 0) {
    const notifier = createNotifier(logger);
    await notifier.notify(newListings);
  }
};

// in local dev environment, run the handler immediately
if (!IS_LAMDA) {
  handler(null);
}
