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
  // Instead of ready PageRunner instances, pass the *constructors* (or factories)
  sites: BaseScrapeObject[];
  // storage mechanism to use.
  storage: Storage; // default to in-memory
  // how many items to queue at once.
  concurrency?: number; // default to 3
  // launch options for the browser.
  browserOptions?: LaunchOptions;
}

interface ScrapeOptionsInternal {
  logger: Logger;
  // Instead of ready PageRunner instances, pass the *constructors* (or factories)
  sites: BaseScrapeObject[];
  // the browse instance to use.
  browser: Browser; // optional, if not provided, a new browser will be launched,
  // page
  pages: Page[];
  // storage mechanism
  storage: Storage; // default to in-memory
}

interface ListingTaskApi {
  strategy: SiteStrategy.Api;
  siteHandler: BaseApiObject;
  url: undefined;
}

interface ListingTaskBrowser {
  strategy: SiteStrategy.Paginated;
  siteHandler: BasePageObjectPaginated;
  url: string;
}

type ListingTask = ListingTaskApi | ListingTaskBrowser;

/**
 * Represents a handle to the browser instance that will run automation.
 */
export class ScrapeHandle {
  private logger: Logger;
  private sites: BaseScrapeObject[];
  private storage: Storage;
  private browser: Browser;
  private pages: Page[] = [];
  private queue: ListingTask[] = [];

  private constructor({
    logger,
    sites,
    browser,
    pages,
    storage,
  }: ScrapeOptionsInternal) {
    this.logger = logger.child({ component: ScrapeHandle.name });
    this.sites = sites;
    this.browser = browser;
    this.pages = pages;
    this.storage = storage;
  }

  static async create(options: ScrapeOptions) {
    chromium.use(stealth());
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

  async run(): Promise<Listing[]> {
    await this.enqueueTasks();
    const chunks = chunkArray(this.queue, this.pages.length);
    this.logger.info(
      { totalSites: this.sites.length, chunks: chunks.length },
      "Starting scrape",
    );

    for (const [_, chunk] of chunks.entries()) {
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
    await this.browser.close();
    for (const page of this.pages) {
      await page.close();
    }
    return newListings;
  }

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

  async enqueueApi(site: BaseApiObject) {
    this.queue.push({
      siteHandler: site,
      strategy: site.siteStrategy,
      url: undefined,
    });
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
