import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class TheCBAGroup implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "thecbagroup";
  baseUrl = "https://thecbagroup.com";
  path = "/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page
      .locator(".content-associates")
      .locator(".container")
      .locator(".row")
      .locator("a");
  }

  async getTitle(container: Locator): Promise<string | null> {
    return container
      .locator("p")
      .first()
      .textContent()
      .then((t) => t?.trim() || null);
  }

  async getHref(container: Locator): Promise<string | null> {
    // Using getByTitle("View Details") since strategy = "title"
    return container.getAttribute("href");
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    return [new URL(this.path, this.baseUrl).toString()];
  }
}
