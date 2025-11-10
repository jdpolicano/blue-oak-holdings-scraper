import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class NewLeafBrokerage implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "newleafbrokerage";
  baseUrl = "https://www.newleafbrokerage.com/";
  path = "/bb/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator(".listing-box");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator(".listing-title").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator(".listing-title a").getAttribute("href");
  }

  async getId({ container, page, href }: IdSearchContext): Promise<string> {
    const listingIdContainer = container.locator("div", {
      has: page.locator("span.description-name", { hasText: /Listing ID:/i }),
      hasNot: page.locator("div"),
    });

    if ((await listingIdContainer.count()) === 0) {
      return href;
    }

    const idSpan = listingIdContainer.locator("span.description-value");
    if ((await idSpan.count()) === 0) {
      return href;
    }

    const idText = await idSpan.textContent();
    if (!idText) return href;
    return idText.trim();
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    return [url.toString()];
  }
}
