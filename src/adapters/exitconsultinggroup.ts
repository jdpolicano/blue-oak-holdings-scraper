import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class ExitConsultingGroup implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "exitconsultinggroup";
  baseUrl = "https://exitconsultinggroup.com/";
  path = "/listings";

  getContainerLocator(page: Page): Locator {
    return page.locator("a.box-shadow-5");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.getByRole("heading").first().textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.getAttribute("href");
  }

  async getId({ href }: IdSearchContext): Promise<string> {
    return href;
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.waitForLoadState("networkidle");
    const loadMoreBtn = page.getByRole("button", {
      name: "LOAD MORE",
    });
    const isVisibleSafe = () => loadMoreBtn.isVisible().catch(() => false);
    // Click "Load More Listings" until it no longer exists
    while (await isVisibleSafe()) {
      await loadMoreBtn.click();
      await page.waitForLoadState("networkidle");
    }
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
