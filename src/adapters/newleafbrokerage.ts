import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

const NEW_LEAF_PAGE_TIMEOUT_MS = 60_000;
const LISTING_BOX_SELECTOR = ".listingBox";
const LISTING_TITLE_SELECTOR = ".listingTitle";
const DESCRIPTION_NAME_SELECTOR = ".descriptionName";
const DESCRIPTION_VALUE_SELECTOR = ".descriptionValue";
const INTERNAL_ID_LABEL_PATTERN = /Internal ID:/i;

export class NewLeafBrokerage implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "newleafbrokerage";
  baseUrl = "https://www.newleafbrokerage.com/";
  path = "/bb/businesses-for-sale";

  getContainerLocator(page: Page): Locator {
    return page.locator(LISTING_BOX_SELECTOR);
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator(LISTING_TITLE_SELECTOR).textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator(`${LISTING_TITLE_SELECTOR} a`).getAttribute("href");
  }

  async getId({ container, page, href }: IdSearchContext): Promise<string> {
    const listingIdContainer = container.locator("div", {
      has: page.locator(DESCRIPTION_NAME_SELECTOR, {
        hasText: INTERNAL_ID_LABEL_PATTERN,
      }),
      hasNot: page.locator("div"),
    });

    if ((await listingIdContainer.count()) === 0) {
      return href;
    }

    const idSpan = listingIdContainer.locator(DESCRIPTION_VALUE_SELECTOR);
    if ((await idSpan.count()) === 0) {
      return href;
    }

    const idText = await idSpan.textContent();
    if (!idText) return href;
    return idText.trim();
  }

  async onPageLoad(page: Page): Promise<void> {
    await page.locator(LISTING_BOX_SELECTOR).first().waitFor({
      state: "attached",
      timeout: NEW_LEAF_PAGE_TIMEOUT_MS,
    });
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    return [url.toString()];
  }
}
