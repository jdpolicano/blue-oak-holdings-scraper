import { Logger } from "pino";
import { Browser, Page, LaunchOptions } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { Storage } from "./storage/index.js";
import { Listing } from "./models/listing.js";
import { BrowserRunner, BrowserRunnerOptions } from "./browser/runner.js";

import {
  BaseApiObject,
  BasePageObjectPaginated,
  BasePageObjectHuman,
  SiteStrategy,
  BaseScrapeObject,
} from "../adapters/base.js";

interface ScrapeHandleOverrides {
  sites: BaseScrapeObject[];
}

interface ScrapeHandleInternalOverrides {
  sites: BaseApiObject[];
  browserRunner: BrowserRunner;
}

export type ScrapeHandleOptions = Omit<BrowserRunnerOptions, "sites"> &
  ScrapeHandleOverrides;

type ScrapeHandleInternalOptions = Omit<BrowserRunnerOptions, "sites"> &
  ScrapeHandleInternalOverrides;

type BrowserSite = BasePageObjectPaginated | BasePageObjectHuman;

/**
 * Represents a handle to the browser instance that will run automation.
 * This class manages the lifecycle of the browser, pages, and tasks for scraping.
 */
export class ScrapeHandle {
  // Logger instance for logging messages.
  private logger: Logger;
  // List of site handlers to scrape.
  private apiSites: BaseApiObject[];
  // storage mechanism to save scraped data.
  private storage: Storage;

  private browserRunner: BrowserRunner;

  private constructor({
    logger,
    sites,
    storage,
    browserRunner,
  }: ScrapeHandleInternalOptions) {
    this.logger = logger.child({ component: ScrapeHandle.name });
    // Create a child logger specific to the ScrapeHandle class.
    this.apiSites = sites;
    this.storage = storage;
    this.browserRunner = browserRunner;
  }

  /**
   * Factory method to create and initialize a ScrapeHandle instance.
   * Sets up the browser, pages, and other configurations.
   */
  static async create(options: ScrapeHandleOptions) {
    const browserSites = options.sites.filter(
      (site): site is BrowserSite =>
        site.siteStrategy === SiteStrategy.Paginated ||
        site.siteStrategy === SiteStrategy.Human,
    );
    const apiSites = options.sites.filter(
      (site): site is BaseApiObject => site.siteStrategy === SiteStrategy.Api,
    );
    const browserRunner = await BrowserRunner.create({
      ...options,
      logger: options.logger.child({ component: BrowserRunner.name }),
      sites: browserSites,
    });
    return new ScrapeHandle({
      ...options,
      sites: apiSites,
      browserRunner,
    });
  }

  /**
   * Main method to run the scraping process.
   * Processes tasks in chunks and collects the scraped listings.
   */
  async run(): Promise<Listing[]> {
    const t0 = Date.now();
    this.logger.info("Starting scrape handle run");
    // Process browser-based sites in chunks
    await this.browserRunner.run();
    // Process API-based sites sequentially
    for (const siteHandler of this.apiSites) {
      await this.processApi(siteHandler);
    }
    const t1 = Date.now();
    this.logger.info({ durationMs: t1 - t0 }, "Completed scrape handle run");
    return this.storage.finalize();
  }

  /**
   * Processes a task using the API strategy.
   * Fetches listings via the site's API and appends them to storage.
   */
  async processApi(siteHandler: BaseApiObject) {
    try {
      const listings = await siteHandler.fetchListings(
        this.logger.child({ site: siteHandler.site }),
      );
      if (listings.length) {
        await this.storage.appendListing(...listings);
        this.logger.info(
          {
            site: siteHandler.site,
            total: listings.length,
          },
          "Listings found",
        );
      } else {
        this.logger.warn({ site: siteHandler.site }, "No listings found");
      }
    } catch (err) {
      this.logger.error(
        { site: siteHandler.site, err },
        "Error fetching API listings",
      );
    }
  }
}
