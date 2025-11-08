import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class TheMagnoliaFirm implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "themagnoliafirm";
  baseUrl = "https://www.themagnoliafirm.com/";
  path = "/current-listings";

  getContainerLocator(page: Page): Locator {
    return page
      .locator(".page-section", {
        has: page.locator("div", { hasText: /Recent Listings/ }),
      })
      .locator("div.summary-item");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator("a.summary-title-link").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator("a.summary-title-link").getAttribute("href");
  }

  async getId({ href }: IdSearchContext): Promise<string> {
    return href;
  }

  async onPageLoad(page: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    return [url.toString()];
  }
}
