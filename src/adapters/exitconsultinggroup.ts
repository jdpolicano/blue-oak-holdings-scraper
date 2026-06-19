import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

const EXIT_PAGE_TIMEOUT_MS = 60_000;
const LOAD_MORE_TIMEOUT_MS = 15_000;
const MAX_LOAD_MORE_CLICKS = 20;
const LISTING_SELECTOR = "a.box-shadow-5";
const LOAD_MORE_BUTTON_LABEL = "LOAD MORE";

export class ExitConsultingGroup implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "exitconsultinggroup";
  baseUrl = "https://exitconsultinggroup.com/";
  path = "/listings";

  getContainerLocator(page: Page): Locator {
    return page.locator(LISTING_SELECTOR);
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
    const listings = page.locator(LISTING_SELECTOR);
    await listings.first().waitFor({
      state: "attached",
      timeout: EXIT_PAGE_TIMEOUT_MS,
    });

    const loadMoreBtn = page.getByRole("button", {
      name: LOAD_MORE_BUTTON_LABEL,
    });

    for (let clickCount = 0; clickCount < MAX_LOAD_MORE_CLICKS; clickCount++) {
      if (!(await this.isLoadMoreVisible(loadMoreBtn))) return;

      const previousListingCount = await listings.count();
      await loadMoreBtn.click();
      const loadedMoreListings = await this.waitForListingProgress(
        page,
        previousListingCount,
      );

      if (!loadedMoreListings) return;
    }
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }

  private async isLoadMoreVisible(loadMoreBtn: Locator): Promise<boolean> {
    try {
      return await loadMoreBtn.isVisible();
    } catch {
      return false;
    }
  }

  private async waitForListingProgress(
    page: Page,
    previousListingCount: number,
  ): Promise<boolean> {
    try {
      await page.waitForFunction(
        ({ buttonLabel, listingSelector, previousCount }) => {
          const listingCount = document.querySelectorAll(listingSelector).length;
          const loadMoreButton = Array.from(
            document.querySelectorAll("button"),
          ).find(
            (button) =>
              button.textContent?.trim().toUpperCase() === buttonLabel &&
              button.getClientRects().length > 0,
          );

          return listingCount > previousCount || !loadMoreButton;
        },
        {
          buttonLabel: LOAD_MORE_BUTTON_LABEL,
          listingSelector: LISTING_SELECTOR,
          previousCount: previousListingCount,
        },
        { timeout: LOAD_MORE_TIMEOUT_MS },
      );
      return true;
    } catch {
      return false;
    }
  }
}
