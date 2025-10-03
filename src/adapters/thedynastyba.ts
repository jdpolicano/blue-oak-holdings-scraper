import { Page } from "playwright";
import { Listing } from "../core/listing.js";
import { PageObject } from "../core/page.js";

export class TheDynastyBaPage extends PageObject {
  constructor() {
    super("https://thedynastyba.com", "/listings");
  }

  shouldStop(_: Page): boolean {
    return true;
  }

  isMultiPage(_: Page): boolean {
    return true;
  }

  async getListings(page: Page): Promise<Listing[]> {
    const date = new Date().toISOString();
    const site = this.root;
    const listingContainers = await page.locator(".listing-card").all();
    return Promise.all(
      listingContainers.map(async (loc) => {
        const title = await loc.locator(".listing-name").textContent();
        if (title == null) {
          throw new Error("null title");
        }
        const href = await loc.getByTitle("View Details").getAttribute("href");
        if (href === null) {
          throw new Error("null href");
        }
        return {
          title,
          href,
          site,
          date,
        };
      }),
    );
  }

  async nextPage(_: Page): Promise<void> {}
}
