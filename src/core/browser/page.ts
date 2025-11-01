import { Page, Locator } from "playwright";
import { Listing } from "../models/listing.js";
import { Logger } from "pino";
import {
  BasePageObjectHuman,
  BasePageObjectPaginated,
} from "../../adapters/base.js";
import { createHash } from "node:crypto";
import retry from "p-retry";

/**
 * PageRunner is responsible for orchestrating the scraping of listings from a paginated webpage.
 * It handles retries, logging, and the extraction of relevant data from the page.
 */
export class PageRunner {
  private retries = 0; // Number of retry attempts for the main scraping function
  private timeout = 3_500; // Minimum timeout between retries in milliseconds
  private logger: Logger; // Logger instance for structured logging

  /**
   * Constructor for PageRunner.
   * @param logger - A pino logger instance for logging messages.
   */
  constructor(logger: Logger) {
    this.logger = logger.child({ component: PageRunner.name });
  }

  /**
   * Generates a SHA-256 hash for a given string.
   * @param content - The string to hash.
   * @returns The resulting hash as a hexadecimal string.
   */
  private hash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private async mapContainer(
    page: Page,
    container: Locator,
    siteHandle: BasePageObjectHuman | BasePageObjectPaginated,
    date: string,
    url: string,
  ): Promise<Listing> {
    const title = await siteHandle.getTitle(container);
    if (!title) {
      this.logger.warn("Missing title field");
    } else {
      this.logger.debug({ title }, "Found listing title");
    }

    const href = await siteHandle.getHref(container);
    if (!href) {
      this.logger.error({ title }, "Missing href field");
      throw new Error("Missing href field");
    } else {
      this.logger.debug({ title, href }, "Found listing href");
    }

    // Resolve the href to an absolute URL
    const resolvedHref = new URL(href, siteHandle.baseUrl).toString();
    // Generate a unique ID for the listing
    const idString = siteHandle.getIdString
      ? await siteHandle.getIdString(page, container, title || "", resolvedHref)
      : resolvedHref;
    const id = this.hash(idString);

    return {
      date,
      site: siteHandle.baseUrl,
      url,
      title,
      href: resolvedHref,
      id,
    };
  }

  /**
   *
   * @param page
   * @param siteHandle
   * @returns
   */
  private async scrapePage(
    page: Page,
    siteHandle: BasePageObjectPaginated | BasePageObjectHuman,
  ): Promise<Listing[]> {
    const containers = await this.waitForElementArray(
      siteHandle.getContainerLocator(page),
    );

    this.logger.debug({ count: containers.length }, "Found listing containers");
    if (!containers.length) {
      throw new Error("No containers found");
    }

    const date = new Date().toISOString();
    const url = page.url();

    const listings = containers.map((container) =>
      this.mapContainer(page, container, siteHandle, date, url),
    );

    return Promise.all(listings);
  }

  /**
   * Waits for elements matching the given locator to appear on the page and returns them as an array.
   * @param loc - A Playwright Locator representing the elements to wait for.
   * @returns An array of Locators for the matching elements.
   */
  private async waitForElementArray(loc: Locator): Promise<Locator[]> {
    try {
      // Wait for the first element to appear within a 60-second timeout
      await loc.first().waitFor({ state: "attached", timeout: 60_000 });
      const count = await loc.count();
      // Create an array of Locators for all matching elements
      return Array.from({ length: count }).map((_, i) => loc.nth(i));
    } catch (e) {
      this.logger.error(e, "waitForElementArray failed");
      return [];
    }
  }

  private async waitForPageLoad(
    page: Page,
    siteUrl: string,
    siteHandle: BasePageObjectHuman | BasePageObjectPaginated,
  ): Promise<void> {
    await Promise.all([
      siteHandle.onPageLoad(page, siteUrl),
      page.goto(siteUrl, { waitUntil: "domcontentloaded" }),
    ]);
    this.logger.debug("Page loaded successfully");
  }

  async getListingsHuman(
    page: Page,
    siteUrl: string,
    siteHandle: BasePageObjectHuman,
  ): Promise<Listing[]> {
    await this.waitForPageLoad(page, siteUrl, siteHandle);
    const listings = [];

    do {
      const newListings = await this.scrapePage(page, siteHandle);
      listings.push(...newListings);
      await siteHandle.nextPage(page);
    } while (!(await siteHandle.shouldStop(page)));

    if (siteHandle.isTailPageScrapable) {
      const newListings = await this.scrapePage(page, siteHandle);
      listings.push(...newListings);
    }

    return listings;
  }

  /**
   * Scrapes listings from a paginated webpage.
   * @param page - The Playwright Page instance to interact with.
   * @param siteUrl - The URL of the site to scrape.
   * @param siteHandle - An instance of BasePageObjectPaginated that provides site-specific scraping logic.
   * @returns A Promise that resolves to an array of Listing objects.
   * @throws An error if the page is closed or if required fields are missing.
   */
  async getListingsPaginated(
    page: Page,
    siteUrl: string,
    siteHandle: BasePageObjectPaginated,
  ): Promise<Listing[]> {
    if (page.isClosed()) {
      throw new Error("Page is closed before starting getListingsPaginated");
    }
    return retry(
      async () => {
        // Load the page and execute any site-specific setup logic
        await this.waitForPageLoad(page, siteUrl, siteHandle);
        // Locate the containers for individual listings
        return this.scrapePage(page, siteHandle);
      },
      {
        onFailedAttempt: (ctx) => {
          this.logger.warn(ctx); // Log details of failed attempts
        },
        shouldRetry: async (_) => {
          return !page.isClosed(); // Only retry if the page is still open
        },
        retries: this.retries, // Maximum number of retries
        minTimeout: this.timeout, // Minimum delay between retries
      },
    );
  }
}
