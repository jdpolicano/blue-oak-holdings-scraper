import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class KensingtonCompany implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "kensingtoncompany";
  baseUrl = "https://kensingtoncompany.com/";
  path = "/business-listings";

  getContainerLocator(page: Page): Locator {
    return page.locator(".business-listing-item");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container
      .locator(".business-listing-title")
      .textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container
      .locator("a.linsting-all-click")
      .first()
      .getAttribute("href");
  }

  async getId({ container, href }: IdSearchContext): Promise<string> {
    const pricesContainer = container.locator(".business-listing-prices");
    const pricesText = await pricesContainer.textContent();

    if (!pricesText) {
      return href;
    }

    const idMatch = pricesText.match(/Listing:\s*(?<id>#\d+)/i);
    if (!idMatch?.groups?.id) {
      return href;
    }

    return idMatch.groups.id.trim();
  }

  async onPageLoad(page: Page): Promise<void> {
    await this.closeCaptchaIfPresent(page);
  }

  async closeCaptchaIfPresent(page: Page): Promise<void> {
    const captchaHeading = page.getByText(/Get notified when specific/i);
    const isVisible = await captchaHeading.isVisible().catch(() => false);
    if (isVisible) {
      await page.locator("#businessListing").getByText("×").click();
    }
  }

  async getUrls(page: Page): Promise<string[]> {
    const searchPage = new URL(this.path, this.baseUrl).toString();
    const nextButton = page.getByRole("link", { name: "Next Page" });
    const isVisibleSafe = (sel: Locator) => sel.isVisible().catch(() => false);
    const allNextLinks = page
      .locator(".wp-pagenavi")
      .locator("a.page", { hasText: /\d+/ });

    const urls = [searchPage];
    await Promise.all([
      page.goto(urls[urls.length - 1]),
      this.onPageLoad(page),
    ]);

    while (await isVisibleSafe(nextButton)) {
      await this.closeCaptchaIfPresent(page);
      const allLinks = await allNextLinks.all();

      for (const link of allLinks) {
        const href = await link.getAttribute("href");
        if (href && !urls.includes(href)) {
          urls.push(href);
        }
      }

      await Promise.all([
        page.goto(urls[urls.length - 1]),
        this.onPageLoad(page),
      ]);
    }

    return urls;
  }
}
