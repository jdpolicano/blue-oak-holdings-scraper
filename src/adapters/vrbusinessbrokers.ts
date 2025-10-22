import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class VRBusinessBrokers implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "vrbusinessbrokers";
  baseUrl = "https://www.vrbusinessbrokers.com/";
  path = "/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator("a", { has: page.locator(".vrbb-listing-box") });
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator(".vrbb-listing-title").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.getAttribute("href");
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const lastPageLink = page.locator("a.wpv-filter-last-link", {
      hasText: "Last",
    });
    const lastPageHref = await lastPageLink.getAttribute("href");
    if (lastPageHref === null) {
      return [];
    }
    const lastPageUrl = new URL(lastPageHref, this.baseUrl);
    const pageQueryParam = lastPageUrl.searchParams.get("wpv_paged");

    if (pageQueryParam === null) {
      return [];
    }

    const maxPage = parseInt(pageQueryParam);
    if (isNaN(maxPage)) {
      return [];
    }

    if (maxPage < 2) {
      return [url]; // no pagination found, return just the first page
    }

    const urls = [url]; // include the first page
    for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
      // use the last page as a template, just change the page number
      lastPageUrl.searchParams.set("wpv_paged", pageNum.toString());
      urls.push(lastPageUrl.toString());
    }
    return urls;
  }
}
