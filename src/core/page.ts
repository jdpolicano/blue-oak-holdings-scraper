import { Page } from "playwright";
import { Listing } from "./listing.js";
/**
 * Represents a target page we want to automate over.
 */
export abstract class PageObject {
  root: string;
  listingPath: string;

  constructor(root: string, listingPath: string) {
    this.root = root;
    this.listingPath = listingPath;
  }
  // get the url of this page. used to set page.goto so we can build this class.
  getUrl(): string {
    const fullUrl = new URL(this.listingPath, this.root);
    return fullUrl.toString();
  }
  // get all of the listings on the current page.
  abstract getListings(page: Page): Promise<Listing[]>;
  // whether or not this site requires pagination
  abstract isMultiPage(page: Page): boolean;
  // whether we have hit a stopping condition.
  // i.e., no more listings to check or we have already hit one we've seen before in the case of a sorted list
  abstract shouldStop(page: Page): boolean;
  // move pages if !shouldStop
  abstract nextPage(page: Page): Promise<void>;
}
