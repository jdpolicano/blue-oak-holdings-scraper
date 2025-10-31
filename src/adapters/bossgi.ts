import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class BossGI implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "bossgi";
  baseUrl = "https://bossgi.com/";
  path = "/businesses-over-a-million";

  getContainerLocator(page: Page): Locator {
    return page.locator(".catdisplay").locator("xpath=ancestor::tbody[1]");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator(".catdisplay").textContent();
    const listingNumber = await container.locator(".findisplay").textContent();
    if (title === null || listingNumber === null) {
      throw new Error(
        `${this.site}: Title or listing number is null and is required`,
      );
    }
    return `${title.trim()} - ${listingNumber.trim()}`;
  }

  async getHref(_: Locator): Promise<string | null> {
    return new URL(this.path, this.baseUrl).toString();
  }

  async getIdString(
    _page: Page,
    _container: Locator,
    title: string,
    _href: string,
  ): Promise<string> {
    return title;
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.locator(".displaysmall").last().click();
    await page.waitForLoadState("networkidle");
  }

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    await page.goto(url);
    const frame = page.frames()[1];
    return [frame.url()];
  }
}
