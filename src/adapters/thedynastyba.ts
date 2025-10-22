import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class TheDynastyBA implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "thedynastyba";
  baseUrl = "https://thedynastyba.com/";
  path = "/listings";

  getContainerLocator(page: Page): Locator {
    return page.locator(".listing-card");
  }

  async getTitle(container: Locator): Promise<string | null> {
    return container.locator(".listing-name").textContent();
  }

  async getHref(container: Locator): Promise<string | null> {
    // Using getByTitle("View Details") since strategy = "title"
    return container.getByTitle("View Details").getAttribute("href");
  }

  async onPageLoad(page: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    await page.goto(url);
    const pagination = await page.locator("a.page-numbers").all();
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
    const urls = [url]; // include the first page
    for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
      urls.push(`${url}/page/${pageNum}`);
    }
    return urls;
  }
}
