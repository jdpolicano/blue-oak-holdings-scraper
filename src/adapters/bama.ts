import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class BAMA implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "bama";
  fullName = "Business Acquisition & Merger Advisors (BAMA)";
  baseUrl = "https://www.buysellyourbusiness.com/";
  path = "/current-engagements";

  getContainerLocator(page: Page): Locator {
    return page.locator("ul.engagement-list > li");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator("div.cell.type").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator("a.readmore").getAttribute("href");
  }

  async getId({ href }: IdSearchContext): Promise<string> {
    return href;
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
