import { Page, Locator } from "playwright";
import { BasePageObjectPaginated, SiteStrategy } from "./base.js";

export class PronovaPartners implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "pronovapartners";
  baseUrl = "https://pronovapartners.com/";
  path = "/engagements";

  getContainerLocator(page: Page): Locator {
    return page.locator(".property-item");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator(".property-title").textContent();
    if (title === null) return title;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container
      .locator("a.btn.btn-primary", { hasText: /Details/ })
      .first()
      .getAttribute("href");
  }

  async onPageLoad(page: Page): Promise<void> {
    const loadMoreBtn = page.getByRole("link", { name: "Load More" });
    const spinner = page.locator("i.fa-spinner");
    await loadMoreBtn.waitFor();
    const isVisibleSafe = (loc: Locator) => loc.isVisible().catch((_) => false);
    const shouldContinue = async () => {
      // Wait for spinner to disappear
      while (await isVisibleSafe(spinner)) {}
      // Check if "Load More" is still visible and spinner is not visible
      return isVisibleSafe(loadMoreBtn);
    };
    // Click "Load more" until it no longer exists
    while (await shouldContinue()) {
      await loadMoreBtn.click();
      await page.waitForResponse("**/wp-admin/admin-ajax.php");
    }
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    return [url.toString()];
  }
}
