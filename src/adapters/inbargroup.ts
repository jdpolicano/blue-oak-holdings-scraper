import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class InbarGroup implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "inbargroup";
  baseUrl = "https://inbargroup.com/";
  path = "/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator(".listing-box");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator(".listing-title a").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator(".listing-title a").getAttribute("href");
  }

  async getId({ container, href, page }: IdSearchContext): Promise<string> {
    const idLocator = container
      .locator("div", {
        hasText: /Listing ID:/,
        hasNot: page.locator("div", { hasText: /Listing ID:/ }),
      })
      .locator("span.description-value");
    if ((await idLocator.count()) === 0) {
      return href;
    }
    const id = await idLocator.textContent();
    if (!id) throw new Error(`ID not found in container`);
    return id.trim();
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    await page.goto(url);
    let pageLinkLoc = page.locator(".wpv-filter-pagination-link");
    await pageLinkLoc.first().waitFor();
    const urls = [url];
    for (const pageLink of await pageLinkLoc.all()) {
      const nextPageUrl = await pageLink.getAttribute("href");
      if (nextPageUrl && !urls.includes(nextPageUrl)) {
        const resolved = new URL(nextPageUrl, this.baseUrl).toString();
        urls.push(resolved);
      }
    }
    return urls;
  }
}
