import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class VikingMergers implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "vikingmergers";
  baseUrl = "https://www.vikingmergers.com/";
  path = "/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator(".jet-listing-grid__item");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container
      .locator("h3.elementor-heading-title")
      .textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator("a.elementor-button").first().getAttribute("href");
  }

  async getId({ title }: IdSearchContext): Promise<string> {
    const idMatch = title?.match(/#\s*(?<id>\d+)/);
    if (!idMatch || !idMatch.groups) {
      throw new Error(`ID format not recognized: ${title}`);
    }
    return idMatch.groups.id;
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.waitForLoadState("networkidle");
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
