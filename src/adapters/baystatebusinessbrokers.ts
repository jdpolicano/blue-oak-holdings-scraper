import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class BayStateBusinessBrokers implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "baystatebusinessbrokers";
  baseUrl = "https://www.baystatebusinessbrokers.com/";
  path = "/businesses-for-sale-in-ma-nh-ct-ri";

  getContainerLocator(page: Page): Locator {
    return page.locator(".listingContent");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container
      .locator(".listingTitle")
      .getByRole("heading")
      .textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container
      .locator(".listingTitle")
      .getByRole("link")
      .getAttribute("href");
  }

  async getId({ container, href }: IdSearchContext): Promise<string> {
    const idTextLocator = container
      .locator(".internalID")
      .locator(".descriptionValue");
    if ((await idTextLocator.count()) === 0) {
      return href;
    }
    const idText = await idTextLocator.textContent();
    if (!idText) return href;
    return idText.trim();
  }
  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
