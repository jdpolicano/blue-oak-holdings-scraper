import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class BizBuySell implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "bizbuysell";
  baseUrl = "https://www.bizbuysell.com/";
  path = "/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator("a:has(span.favorite)");
  }

  async getTitle(container: Locator): Promise<string | null> {
    return container.getAttribute("title");
  }

  async getHref(container: Locator): Promise<string | null> {
    // Using getByTitle("View Details") since strategy = "title"
    return container.getAttribute("href");
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    await page.goto(url + "/1", { waitUntil: "domcontentloaded" });
    // we need to scroll the page for some reason.
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));

    const pageNums = await page
      .getByRole("navigation", { name: "Pagination" })
      .locator("a", { hasText: /\d+/ })
      .allTextContents();

    const asNums = pageNums
      .map((t) => parseInt(t.trim()))
      .filter((n) => !isNaN(n));

    const maxPage = Math.max(...asNums);
    if (maxPage > 1) {
      const urls = []; // include the first page
      for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
        urls.push(`${url}/${pageNum}`);
      }
      return urls;
    }
    return [];
  }
}
