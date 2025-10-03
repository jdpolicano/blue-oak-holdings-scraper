import { TheDynastyBaPage } from "./adapters/thedynastyba.js";
import { BrowserHandle } from "./core/browser.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

export const handler = async (_: unknown) => {
  const handle = new BrowserHandle({
    logger,
    browserName: "chromium",
    pages: [new TheDynastyBaPage()],
  });

  await handle.run();
};

handler(null);
