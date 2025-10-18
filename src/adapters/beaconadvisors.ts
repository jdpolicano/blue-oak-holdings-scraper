import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class BeaconAdvisors implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "beaconadvisors";
  baseUrl = "https://www.beaconadvisors.com/";
  path = "/current-businesses-for-sale";

  async getContainers(page: Page): Promise<Locator[]> {
    return page.locator(".bmaListingBox").all();
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

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
