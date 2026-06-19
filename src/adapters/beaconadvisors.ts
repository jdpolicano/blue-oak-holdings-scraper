import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class BeaconAdvisors implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "beaconadvisors";
  baseUrl = "https://www.beaconadvisors.com/";
  path = "/current-businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator(".bmaListingBox");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator(".bmaListingTitle").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container
      .locator("a", { hasText: "Learn More" })
      .getAttribute("href");
  }

  async getId({ page, href }: IdSearchContext): Promise<string> {
    await page.goto(href);
    const bmaIdRegex = /BA\d+/i; // i.e., BA12345
    const id = await page
      .locator(".bmaValue", { hasText: bmaIdRegex })
      .textContent();
    if (!id) throw new Error(`ID not found for href: ${href}`);
    await page.goBack();
    return id.trim();
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
