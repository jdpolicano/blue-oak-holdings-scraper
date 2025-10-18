import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class MorganWestfield implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "morganwestfield";
  baseUrl = "https://morganandwestfield.com/";
  path = "/buy/businesses-for-sale/";
  altPath = "/buy/main-street-businesses-for-sale/";

  async getContainers(page: Page): Promise<Locator[]> {
    return page.locator("article.business-for-sale").all();
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator("h3").first().textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator("a").first().getAttribute("href");
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    const altUrl = new URL(this.altPath, this.baseUrl);
    return [url.toString(), altUrl.toString()];
  }
}
