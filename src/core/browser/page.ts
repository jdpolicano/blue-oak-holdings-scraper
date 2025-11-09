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
  private retries = 3; // Number of retry attempts for the main scraping function
  private timeout = 5000; // Minimum timeout between retries in milliseconds
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
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
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

    const hrefText = await siteHandle.getHref(container);
    if (hrefText === null || hrefText.length === 0) {
      this.logger.error({ title }, "Missing href field");
      throw new Error("Missing href field");
    } else {
      this.logger.debug({ title, href: hrefText }, "Found listing href");
    }

    // Resolve the href to an absolute URL
    const href = new URL(hrefText, siteHandle.baseUrl).toString();

    // if the siteHandle has a getId method, use it to get the listing number
    const listingId = await siteHandle.getId({
      page,
      href,
      container,
      title,
      logger: this.logger.child({ component: siteHandle.constructor.name }),
    });

    // namespace the listing id to avoid collisions across different sites
    const listingIdNamespaced = `${siteHandle.site}:${listingId}`;
    const id = this.hash(listingIdNamespaced);

    return {
      date,
      site: siteHandle.site,
      url,
      title,
      href,
      listingId: listingIdNamespaced,
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
      this.logger.warn("No containers found on the page");
      return [];
    }

    const date = new Date().toISOString();
    const url = page.url();
    const listings = [];
    for (const container of containers) {
      const listing = await this.mapContainer(
        page,
        container,
        siteHandle,
        date,
        url,
      );
      listings.push(listing);
    }

    return listings;
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
      throw e;
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
    if (page.isClosed()) {
      throw new Error("Page is closed before starting getListingsHuman");
    }

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
        const listings = await this.scrapePage(page, siteHandle);
        return listings;
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
