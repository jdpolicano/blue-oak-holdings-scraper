import { Logger } from "pino";
import { Browser, Page } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { Parser } from "@json2csv/plainjs";

import {
  BaseApiObject,
  BasePageObjectPaginated,
  BasePageObjectHuman,
  BaseScrapeObject,
  SiteStrategy,
} from "../adapters/base.js";
import fs from "node:fs/promises";
import { PageRunner } from "./page.js";
import { Listing } from "./listing.js";

export interface ScrapeOptions {
  logger: Logger;
  // Instead of ready PageRunner instances, pass the *constructors* (or factories)
  sites: BaseScrapeObject[];
  // how many items to queue at once.
  concurrency?: number; // default to 3
}

interface ScrapeOptionsInternal {
  logger: Logger;
  // Instead of ready PageRunner instances, pass the *constructors* (or factories)
  sites: BaseScrapeObject[];
  // the browse instance to use.
  browser: Browser; // optional, if not provided, a new browser will be launched,
  // page
  pages: Page[];
}

interface ListingTaskApi {
  siteHandler: BaseApiObject;
}

interface ListingTaskBrowser {
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
  private listings: Listing[] = [];
  private browser: Browser;
  private pages: Page[] = [];
  private queue: ListingTask[] = [];
  private seenIds: Map<string, Listing> = new Map(); // to track seen listing IDs

  private constructor({
    logger,
    sites,
    browser,
    pages,
  }: ScrapeOptionsInternal) {
    this.logger = logger;
    this.sites = sites;
    this.browser = browser;
    this.pages = pages;
  }

  static async create(options: ScrapeOptions) {
    chromium.use(stealth());
    const browser = await chromium.launch({ headless: true });
    const numPages = options.concurrency || 3;
    const pages: Page[] = [];
    for (let i = 0; i < numPages; i++) {
      const page = await browser.newPage();
      pages.push(page);
    }
    return new ScrapeHandle({ ...options, pages, browser });
  }

  async run() {
    await this.enqueueTasks();
    const chunks = chunkArray(this.queue, this.pages.length);
    this.logger.info(
      { totalSites: this.sites.length, chunks: chunks.length },
      "Starting scrape",
    );

    for (const [_, chunk] of chunks.entries()) {
      const tasks = chunk.map((task, i) => {
        if (task.siteHandler.siteStrategy === SiteStrategy.Api) {
          return this.processApi(task.siteHandler);
        } else {
          return this.processUrl(
            this.pages[i],
            (task as ListingTaskBrowser).url,
            task.siteHandler,
          );
        }
      });
      await Promise.all(tasks);
    }

    if (this.listings.length) {
      const outPath = "./listings.csv";
      const parser = new Parser();
      const csv = parser.parse(this.listings);
      await fs.writeFile(outPath, csv, { encoding: "utf-8" });
      this.logger.info(
        { count: this.listings.length, path: outPath },
        "Listings saved",
      );
    }
    await this.browser.close();
    for (const page of this.pages) {
      await page.close();
    }
  }

  async processApi(siteHandler: BaseApiObject) {
    try {
      const listings = await siteHandler.fetchListings(
        this.logger.child({ site: siteHandler.site }),
      );
      if (listings.length) {
        const uniqueListings = this.filterUniqueListings(listings, siteHandler);
        this.listings.push(...uniqueListings);
        this.logger.info(
          {
            site: siteHandler.site,
            total: listings.length,
            unique: uniqueListings.length,
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
        this.logger.child({ site: siteHandler.site, url: siteUrl }),
      );
      const listings = await runner.getListingsPaginated(
        page,
        siteUrl,
        siteHandler,
      );
      if (listings.length) {
        const uniqueListings = this.filterUniqueListings(listings, siteHandler);
        this.listings.push(...uniqueListings);
        this.logger.info(
          {
            site: siteHandler.site,
            total: listings.length,
            unique: uniqueListings.length,
            url: siteUrl,
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

  private filterUniqueListings(
    listings: Listing[],
    siteHandler: BaseScrapeObject,
  ): Listing[] {
    return listings.filter((listing) => {
      if (this.seenIds.has(listing.id)) {
        const existing = this.seenIds.get(listing.id);
        this.logger.warn(
          {
            site: siteHandler.site,
            id: listing.id,
            title: listing.title,
            href: listing.href,
            url: listing.url,
            existingId: existing?.id,
            exisistingTitle: existing?.title,
            existingHref: existing?.href,
            existingUrl: existing?.url,
          },
          "Duplicate listing found, skipping",
        );
        return false;
      }
      this.seenIds.set(listing.id, listing);
      return true;
    });
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
        this.queue.push({ url, siteHandler: site });
      }
    } catch (err) {
      this.logger.error({ site: site.site, err }, "Error enqueuing paginated");
    }
  }

  async enqueueApi(site: BaseApiObject) {
    this.queue.push({ siteHandler: site });
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
