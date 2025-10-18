// sunbeltnetwork.ts
import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";
import path from "node:path";

export class SunbeltNetwork implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "sunbeltnetwork";
  baseUrl = "https://www.sunbeltnetwork.com";
  path = "/business-search/business-results";

  async getContainers(page: Page): Promise<Locator[]> {
    return page
      .locator(".resultsBusiness__items")
      .locator(".latestBusinesses__item")
      .all();
  }

  async getTitle(container: Locator): Promise<string | null> {
    return container.locator(".latestBusinesses__item--title").textContent();
  }

  async getHref(container: Locator): Promise<string | null> {
    const button = container
      .locator(".latestBusinesses__item--rightButton")
      .filter({ visible: true });
    return button.getAttribute("href");
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.locator(".loader").waitFor({ state: "hidden" });
  }

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    await page.goto(url);

    const pageCountStr = await page.locator("#countListing").textContent();
    if (!pageCountStr) return [];

    const pageCount = parseInt(pageCountStr.trim());
    if (isNaN(pageCount)) return [];

    const numPages = Math.ceil(pageCount / 10); // assuming 10 listings per page
    const urls = [url]; // we want the first page too
    for (let pageNum = 2; pageNum <= numPages; pageNum++) {
      const pageUrl = `${url}/page/${pageNum}/`;
      urls.push(pageUrl);
    }
    return urls;
  }
}
