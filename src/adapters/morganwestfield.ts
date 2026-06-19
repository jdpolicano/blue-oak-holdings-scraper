import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class MorganWestfield implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "morganwestfield";
  baseUrl = "https://morganandwestfield.com/";
  path = "/buy/businesses-for-sale/";
  altPath = "/buy/main-street-businesses-for-sale/";
  hasRestrictedRoutes = true;

  getContainerLocator(page: Page): Locator {
    return page.locator("article.business-for-sale");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator("h3").first().textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator("a").first().getAttribute("href");
  }

  async getId({ page, href, logger }: IdSearchContext): Promise<string> {
    try {
      await page.goto(href, { waitUntil: "domcontentloaded" });
    } catch {
      logger.warn(`Could not access page for href: ${href}`);
      return href;
    }

    const refNumberLocator = page
      .getByLabel("Business Information")
      .locator(".tbl__row", { hasText: /Business Reference Number:/i });

    if ((await refNumberLocator.count()) === 0) {
      await page.goBack();
      return href;
    }

    const refNumberText = await refNumberLocator.textContent();

    // because we already matched on hasText, this should never be null
    const refNumberMatch = refNumberText!.match(
      /Business Reference Number:\s*(?<id>[a-zA-Z]+-\d+)/i,
    )?.groups;

    if (!refNumberMatch) {
      await page.goBack();
      return href;
    }

    await page.goBack();
    return refNumberMatch.id;
  }

  async onPageLoad(_: Page): Promise<void> {}

  async getUrls(page: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    const altUrl = new URL(this.altPath, this.baseUrl).toString();
    return [
      ...(await this.getUrlsInternal(url, page)),
      ...(await this.getUrlsInternal(altUrl, page)),
    ];
  }

  private async getUrlsInternal(
    pageUrl: string,
    page: Page,
  ): Promise<string[]> {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    const paginationLocator = page.locator(".facetwp-page");
    if ((await paginationLocator.count()) === 0) {
      return [pageUrl];
    }
    const urls = [];
    for (const link of await paginationLocator.all()) {
      await link.click();
      await page.waitForLoadState("domcontentloaded");
      urls.push(page.url());
      if (page.url() !== pageUrl)
        await page.goBack({ waitUntil: "domcontentloaded" });
    }
    return urls;
  }
}
