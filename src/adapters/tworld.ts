import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class TWorld implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "tworld";
  baseUrl = "https://www.tworld.com";
  path = "/buy-a-business/business-listing-search";

  getContainerLocator(page: Page): Locator {
    return page.locator("a.group");
  }
  async getTitle(container: Locator): Promise<string | null> {
    return container.locator("h1").textContent();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.getAttribute("href");
  }

  async getId({ href }: IdSearchContext): Promise<string> {
    return href;
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.waitForResponse("**/api/listings");
  }

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    const [_, res] = await Promise.all([
      page.goto(url.toString()),
      page.waitForResponse("**/api/listings"),
    ]);
    if (!res.ok()) return [];
    const data = await res.json();
    const pageCount = data.pagination?.totalPages;
    if (!pageCount || isNaN(pageCount) || pageCount < 1) return [];
    const urls = [url.toString()]; // include the first page
    for (let pageNum = 2; pageNum <= pageCount; pageNum++) {
      url.searchParams.set("page", pageNum.toString());
      urls.push(url.toString());
    }
    return urls;
  }
}
