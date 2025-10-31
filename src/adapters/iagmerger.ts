import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class IAGMerger implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "iagmerger";
  baseUrl = "https://iagmerger.dealrelations.com/";
  path = "/pages/listings";

  getContainerLocator(page: Page): Locator {
    return page.locator("table.listing-table tbody tr");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container
      .locator(".listings-link-title a")
      .textContent();
    if (title === null) return title;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator(".listings-link-title a").getAttribute("href");
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    await page.goto(url.toString());
    const pagination = await page.locator(".pagination").locator("a").all();
    let maxPage = -1;
    for (const link of pagination) {
      const text = await link.textContent();
      if (text) {
        const pageNum = parseInt(text.trim());
        if (!isNaN(pageNum) && pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    }
    if (maxPage === -1) {
      return []; // no pagination found, return just the first page
    }
    const urls = [url.toString()]; // include the first page
    for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
      url.searchParams.set("page", pageNum.toString());
      urls.push(url.toString());
    }
    return urls;
  }
}
