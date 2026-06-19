import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class LinkBusiness implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "linkbusiness";
  baseUrl = "https://linkbusiness.com/";
  path = "/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator(".card-body");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.getByRole("heading").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container
      .getByRole("heading")
      .getByRole("link")
      .getAttribute("href");
  }

  async getId({ page, container, href }: IdSearchContext): Promise<string> {
    const listingIdLocator = container
      .locator(".card-footer")
      .locator("span", { hasText: /Listing:\s+#/i });

    if ((await listingIdLocator.count()) === 0) {
      return href;
    }

    const listingIdText = await listingIdLocator.textContent();
    if (!listingIdText) {
      return href;
    }

    const match = listingIdText.match(/Listing:\s+#(?<id>[a-zA-Z\d]+)/i);
    if (!match || !match.groups) {
      return href;
    }

    return match.groups.id;
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const pageNext = page.getByRole("link", { name: "Next" });
    const urls: string[] = [];
    const isVisibleSafe = () => pageNext.isVisible().catch(() => false);
    // Collect all paginated URLs
    while (await isVisibleSafe()) {
      urls.push(page.url());
      await pageNext.click();
      await page.waitForLoadState("domcontentloaded");
    }
    urls.push(page.url());
    return urls;
  }
}
