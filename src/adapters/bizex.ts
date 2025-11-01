import { Page, Locator } from "playwright";
import { BasePageObjectHuman, SiteStrategy } from "./base.js";

export class BizEx implements BasePageObjectHuman {
  siteStrategy: SiteStrategy.Human = SiteStrategy.Human;
  site = "bizex";
  baseUrl = "https://www.bizex.net/";
  path = "/business-for-sale";
  isTailPageScrapable = true;

  getContainerLocator(page: Page): Locator {
    return page.locator(".listing");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator("b a").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container
      .getByRole("link", { name: "View Full Listing" })
      .getAttribute("href");
  }

  async shouldStop(page: Page): Promise<boolean> {
    const nextBtn = page.getByRole("link", { name: "Next >" });
    if (!(await nextBtn.isVisible())) {
      return true;
    }
    return false;
  }

  async nextPage(page: Page): Promise<void> {
    const nextBtn = page.getByRole("link", { name: "Next >" });
    await nextBtn.click();
    await page.waitForLoadState("networkidle");
  }

  async onPageLoad(page: Page): Promise<void> {}
}
