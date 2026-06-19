import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class Midstreet implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "midstreet";
  baseUrl = "https://www.midstreet.com/";
  path = "/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator(".business-box");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container
      .locator(".business-nameinfo")
      .locator("h4")
      .first()
      .textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(_: Locator): Promise<string | null> {
    return new URL(this.path, this.baseUrl).toString();
  }

  async getId({ href, title }: IdSearchContext): Promise<string> {
    if (!title) return href;
    return `${href}:${title.replace(/\s+/g, " ").trim()}`;
  }

  async onPageLoad(page: Page): Promise<void> {
    const loadMoreBtn = page.getByRole("link", {
      name: "Load more",
    });
    const isVisibleSafe = () => loadMoreBtn.isVisible().catch(() => false);
    // Click "Load more" until it no longer exists
    while (await isVisibleSafe()) {
      await loadMoreBtn.click();
      await page.waitForLoadState("networkidle");
    }
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    return [url.toString()];
  }
}
