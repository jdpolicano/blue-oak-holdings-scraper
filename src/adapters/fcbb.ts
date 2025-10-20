import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class FCBB implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "fcbb";
  baseUrl = "https://fcbb.com/";
  path = "/businesses-for-sale";

  async getContainers(page: Page): Promise<Locator[]> {
    return page.locator("div.listing").all();
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container
      .locator("a.diamond")
      .first()
      .getAttribute("title");
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator("a.diamond").first().getAttribute("href");
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.waitForResponse("https://api.fcbb.com/Fcbb/GetListings");
  }

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    const [_, response] = await Promise.all([
      page.goto(url.toString(), { waitUntil: "domcontentloaded" }),
      page.waitForResponse("https://api.fcbb.com/Fcbb/GetListings"),
    ]);
    if (!response || !response.ok()) {
      return [];
    }
    const data = await response.json();
    const maxPage = data?.TotalPages;
    const urls = []; // include the first page
    for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
      // use the last page as a template, just change the page number
      url.searchParams.set("page", pageNum.toString());
      urls.push(url.toString());
    }
    return urls;
  }
}
