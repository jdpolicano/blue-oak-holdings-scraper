import { Logger } from "pino";
import { Browser, Page, LaunchOptions } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { Storage } from "./storage/index.js";
import { Listing } from "./models/listing.js";

import {
  BaseApiObject,
  BasePageObjectPaginated,
  BaseScrapeObject,
  SiteStrategy,
} from "../adapters/base.js";
import { PageRunner } from "./browser/page.js";

export interface ScrapeOptions {
  logger: Logger;
  // Logger instance for logging messages throughout the scraping process.
  sites: BaseScrapeObject[];
  // List of site handlers to scrape. Each handler implements the scraping logic for a specific site.
  storage: Storage;
  // Storage mechanism to save scraped data. Defaults to in-memory storage if not provided.
  concurrency?: number;
  // Number of browser pages to run concurrently. Defaults to 3 if not specified.
  browserOptions?: LaunchOptions;
  // Options for launching the browser instance, such as headless mode or proxy settings.
}

interface ScrapeOptionsInternal {
  logger: Logger;
  // Logger instance for internal use within the ScrapeHandle class.
  sites: BaseScrapeObject[];
  // List of site handlers to scrape.
  browser: Browser;
  // Browser instance to use for scraping. If not provided, a new instance will be launched.
  pages: Page[];
  // Array of browser pages to use for concurrent scraping.
  storage: Storage;
  // Storage mechanism to save scraped data.
}

interface ListingTaskApi {
  strategy: SiteStrategy.Api;
  // Indicates that this task uses the API strategy for scraping.
  siteHandler: BaseApiObject;
  // The site handler responsible for fetching data via API.
  url: undefined;
  // URL is not applicable for API-based tasks.
}

interface ListingTaskBrowser {
  strategy: SiteStrategy.Paginated;
  // Indicates that this task uses the paginated strategy for scraping.
  siteHandler: BasePageObjectPaginated;
  // The site handler responsible for scraping paginated pages.
  url: string;
  // The URL to scrape for this task.
}

type ListingTask = ListingTaskApi | ListingTaskBrowser;

/**
 * Represents a handle to the browser instance that will run automation.
 * This class manages the lifecycle of the browser, pages, and tasks for scraping.
 */
export class ScrapeHandle {
  private logger: Logger;
  // Logger instance for logging messages.
  private sites: BaseScrapeObject[];
  // List of site handlers to scrape.
  private storage: Storage;
  // Storage mechanism to save scraped data.
  private browser: Browser;
  // Browser instance used for scraping.
  private pages: Page[] = [];
  // Array of browser pages used for concurrent scraping.
  private queue: ListingTask[] = [];
  // Queue of tasks to be processed.

  private constructor({
    logger,
    sites,
    browser,
    pages,
    storage,
  }: ScrapeOptionsInternal) {
    this.logger = logger.child({ component: ScrapeHandle.name });
    // Create a child logger specific to the ScrapeHandle class.
    this.sites = sites;
    this.browser = browser;
    this.pages = pages;
    this.storage = storage;
  }

  /**
   * Factory method to create and initialize a ScrapeHandle instance.
   * Sets up the browser, pages, and other configurations.
   */
  static async create(options: ScrapeOptions) {
    chromium.use(stealth());
    // Use the stealth plugin to avoid detection by anti-bot mechanisms.
    const browser = await chromium.launch(options.browserOptions || {});
    const numPages = options.concurrency || 3;
    const pages: Page[] = [];
    for (let i = 0; i < numPages; i++) {
      const page = await browser.newPage();
      pages.push(page);
    }
    return new ScrapeHandle({
      ...options,
      pages,
      browser,
    });
  }

  /**
   * Main method to run the scraping process.
   * Processes tasks in chunks and collects the scraped listings.
   */
  async run(): Promise<Listing[]> {
    await this.enqueueTasks();
    // Populate the task queue based on the provided site handlers.
    const chunks = chunkArray(this.queue, this.pages.length);
    // Split the task queue into chunks based on the number of available pages.
    this.logger.info(
      { totalSites: this.sites.length, chunks: chunks.length },
      "Starting scrape",
    );

    // Execute all tasks in the current chunk concurrently.
    for (const chunk of chunks) {
      const tasks = chunk.map((task, i) => {
        if (task.strategy === SiteStrategy.Api) {
          return this.processApi(task.siteHandler);
        } else {
          return this.processUrl(this.pages[i], task.url, task.siteHandler);
        }
      });
      await Promise.all(tasks);
    }
    const newListings = await this.storage.finalize();
    // Finalize the storage and retrieve the collected listings.
    await this.browser.close();
    // Close the browser instance.
    for (const page of this.pages) {
      await page.close();
      // Close all browser pages.
    }
    return newListings;
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

  /**
   * Processes a task using the paginated strategy.
   * Navigates to the specified URL, scrapes listings, and appends them to storage.
   */
  async processUrl(
    page: Page,
    siteUrl: string,
    siteHandler: BasePageObjectPaginated,
  ) {
    try {
      const runner = new PageRunner(
        this.logger.child({
          site: siteHandler.site,
          url: siteUrl,
          component: "page-runner",
        }),
      );
      const listings = await runner.getListingsPaginated(
        page,
        siteUrl,
        siteHandler,
      );
      if (listings.length) {
        await this.storage.appendListing(...listings);
        this.logger.info(
          {
            site: siteHandler.site,
            url: siteUrl,
            total: listings.length,
          },
          "Listings found",
        );
      } else {
        this.logger.warn({ site: siteHandler.site }, "No listings found");
      }
    } catch (err) {
      this.logger.error(
        { site: siteHandler.site, url: siteUrl, err },
        "Error scraping",
      );
    }
  }

  /**
   * Enqueues tasks for all site handlers based on their strategies.
   */
  async enqueueTasks() {
    for (const siteHandler of this.sites) {
      if (siteHandler.siteStrategy === SiteStrategy.Paginated) {
        await this.enqueuePaginated(siteHandler);
      }

      if (siteHandler.siteStrategy === SiteStrategy.Api) {
        await this.enqueueApi(siteHandler);
      }
    }
  }

  /**
   * Enqueues tasks for paginated site handlers.
   * Fetches URLs from the site handler and adds them to the task queue.
   */
  async enqueuePaginated(site: BasePageObjectPaginated) {
    const page = this.pages[0];
    try {
      const urls = await site.getUrls(page);
      for (const url of urls) {
        this.queue.push({
          url,
          siteHandler: site,
          strategy: site.siteStrategy,
        });
      }
    } catch (err) {
      this.logger.error({ site: site.site, err }, "Error enqueuing paginated");
    }
  }

  /**
   * Enqueues tasks for API-based site handlers.
   * Adds the site handler directly to the task queue.
   */
  async enqueueApi(site: BaseApiObject) {
    this.queue.push({
      siteHandler: site,
      strategy: site.siteStrategy,
      url: undefined,
    });
  }
}

/**
 * Utility function to split an array into chunks of a specified size.
 * Used to divide the task queue into manageable chunks for concurrent processing.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
