import { Logger } from "pino";
import { Storage } from "./storage/index.js";
import { Listing } from "./models/listing.js";
import { ScrapingError, ErrorClassifier } from "./models/error.js";
import { BrowserRunner, BrowserRunnerOptions } from "./browser/runner.js";

import {
  BaseApiObject,
  BasePageObjectPaginated,
  BasePageObjectHuman,
  SiteStrategy,
  BaseScrapeObject,
} from "../adapters/base.js";

export interface ScrapeResult {
  /** Listings that were successfully scraped */
  listings: Listing[];
  /** Errors that occurred during scraping */
  errors: ScrapingError[];
}

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
  async run(): Promise<ScrapeResult> {
    const t0 = Date.now();
    this.logger.info("Starting scrape handle run");
    
    // Collect errors from all sources
    const allErrors: ScrapingError[] = [];
    
    // Process browser-based sites in chunks and collect errors
    const browserResult = await this.browserRunner.run();
    allErrors.push(...browserResult.errors);
    
    // Process API-based sites sequentially and collect errors
    for (const siteHandler of this.apiSites) {
      const apiErrors = await this.processApi(siteHandler);
      allErrors.push(...apiErrors);
    }
    
    const t1 = Date.now();
    this.logger.info({ 
      durationMs: t1 - t0, 
      errors: allErrors.length 
    }, "Completed scrape handle run");
    
    const listings = await this.storage.finalize();
    return { listings, errors: allErrors };
  }

  /**
   * Processes a task using the API strategy.
   * Fetches listings via the site's API and appends them to storage.
   * Returns errors that occurred during processing.
   */
  async processApi(siteHandler: BaseApiObject): Promise<ScrapingError[]> {
    const errors: ScrapingError[] = [];
    
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

      // Create and collect error with cause classification
      const scrapingError = ErrorClassifier.createScrapingError(
        err as Error,
        siteHandler.site,
        siteHandler.baseUrl || ""
      );

      errors.push(scrapingError);
      this.logger.warn(
        {
          site: siteHandler.site,
          errorType: scrapingError.errorType,
          description: scrapingError.description,
        },
        "Error detected for API site",
      );
    }

    return errors;
  }
}
