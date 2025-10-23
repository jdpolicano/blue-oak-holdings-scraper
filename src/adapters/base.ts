import { Locator, Page } from "playwright/test";
import { Listing } from "../core/models/listing.js";
import { Logger } from "pino";

export const enum SiteStrategy {
  /**
   * navigate the site like a human.
   * i.e., goto page, scrape info, hit next button.
   * Used when we cannot precompute the page urls to be scraped
   */
  Human,
  /**
   * hit a backend api to collect the data needed.
   */
  Api,
  /**
   * still web-scraping, but we can precompute a list of urls to visit and scrape
   * allowing us to do them out of order etc...
   */
  Paginated,
}

export interface BaseScrapeProps {
  site: string;
  baseUrl: string;
}

/**
 * This is the interfacd for both the paginated and human scrape styles.
 */
export interface BasePageObjectCommon extends BaseScrapeProps {
  onPageLoad(page: Page): Promise<void>;
  getContainerLocator(page: Page): Locator;
  getTitle(container: Page | Locator): Promise<string | null>;
  getHref(container: Page | Locator): Promise<string | null>;
  getIdString?(
    page: Page,
    container: Locator,
    title: string | null,
    href: string,
  ): Promise<string>;
}

export interface BasePageObjectPaginated extends BasePageObjectCommon {
  siteStrategy: SiteStrategy.Paginated;
  /**
   * Return a list of urls to visit and scrape.
   * These will be visited in order, but we can do multiple concurrently.
   */
  getUrls(page: Page): Promise<string[]>;
}

export interface BasePageObjectHuman extends BasePageObjectCommon {
  siteStrategy: SiteStrategy.Human;
  /**
   * Click the next button, or whatever is needed to get to the next page.
   */
  nextPage(page: Page | Locator): Promise<void>;
  /**
   * Return true if we should stop paginating.
   * This could be because there is no next button, or we have reached the end.
   */
  shouldStop(page: Page | Locator): Promise<boolean>;
}

export interface BaseApiObject extends BaseScrapeProps {
  siteStrategy: SiteStrategy.Api;
  /**
   * Fetch listings from the API.
   * This can be called multiple times to get more listings if needed.
   * It should return an empty array when there are no more listings to fetch.
   */
  fetchListings(logger: Logger): Promise<Listing[]>;
}

export type BaseScrapeObject =
  | BasePageObjectPaginated
  | BasePageObjectHuman
  | BaseApiObject;
