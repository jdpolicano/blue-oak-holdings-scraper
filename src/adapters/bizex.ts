import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class BizEx implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "bizex";
  baseUrl = "https://www.bizex.net/";
  path = "/business-for-sale";
  isTailPageScrapable = true;

  getContainerLocator(page: Page): Locator {
    return page.locator(".listing");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator("b a").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container
      .getByRole("link", { name: "View Full Listing" })
      .getAttribute("href");
  }

  async getId({ href, page }: IdSearchContext): Promise<string> {
    await page.goto(href);
    const elementContainer = page.locator(".listing-details").first();
    const idText = await elementContainer.textContent();
    if (!idText) {
      await page.goBack();
      return href;
    }
    const match = idText.match(/BizEx\s+ID:\s*(?<id>BizEx\d+-[a-zA-Z]+)/i);
    if (!match?.groups?.id) {
      await page.goBack();
      return href;
    }
    await page.goBack();
    return match.groups.id;
  }

  async onPageLoad(page: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const baseListingsPage = new URL(this.path, this.baseUrl).toString();
    await page.goto(baseListingsPage, { waitUntil: "domcontentloaded" });
    const pageNumsSelectors = page
      .locator("ul.pagination:not(.pull-right)")
      .getByRole("listitem")
      .getByRole("link");
    const urls = [baseListingsPage];
    for (const pageLink of await pageNumsSelectors.all()) {
      const href = await pageLink.getAttribute("href");
      if (!href) continue;
      const url = new URL(href, baseListingsPage).toString();
      urls.push(url);
    }
    return urls;
  }
}
