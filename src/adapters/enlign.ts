import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class Enlign implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "enlign";
  baseUrl = "https://enlign.com/";
  path = "/listings";

  getContainerLocator(page: Page): Locator {
    return page.locator("#listall .list-box", { hasText: "Full Details" });
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container
      .locator("h5:not(.visuallyhidden)")
      .textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    // Using getByTitle("View Details") since strategy = "title"
    return container
      .locator("a", { hasText: "Full Details" })
      .getAttribute("href");
  }

  async getId({ container }: IdSearchContext): Promise<string> {
    const idText = await container
      .locator("h6", { hasText: /Listing ID:/ })
      .textContent();
    if (!idText) throw new Error("ID not found in container");
    const idMatch = idText.match(/Listing ID:\s*(?<id>[a-zA-Z0-9]+)/)?.groups;
    if (!idMatch) throw new Error(`ID format not recognized: ${idText}`);
    return idMatch.id;
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.waitForResponse("**/getdeallist");
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
