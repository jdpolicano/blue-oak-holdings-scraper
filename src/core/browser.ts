import { Logger } from "pino";
import { chromium, BrowserType, Browser } from "playwright";
import { PageObject } from "./page.js";

export type BrowserName = "chrome" | "chromium" | "edge";

export type BrowserError = "";

export interface BrowserOptions {
  logger: Logger;
  browserName: BrowserName;
  pages: PageObject[];
}

/**
 * Represents a handle to the browser instance that is going to run our automation.
 */
export class BrowserHandle {
  private logger: Logger;
  private name: BrowserName;
  private pages: PageObject[];

  constructor({ logger, browserName, pages }: BrowserOptions) {
    this.logger = logger;
    this.name = browserName;
    this.pages = pages;
  }

  async run() {
    const browser = await chromium.launch();
    for (const page of this.pages) {
      await this.process(browser, page);
    }
    await browser.close();
  }

  async process(browser: Browser, page: PageObject) {
    const p = await browser.newPage();
    await p.goto(page.getUrl());
    const listings = await page.getListings(p);
    console.log(listings);
  }
}
