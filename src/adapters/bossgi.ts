import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

const BOSS_GI_PAGE_TIMEOUT_MS = 60_000;
const BOSS_GI_FIRST_PAGE_SIZE = 100;
const START_SEARCH_SELECTOR = 'input[value="Start Search"]';
const DISPLAY_ALL_SELECTOR = 'input[name="displayall"][value="All"]';
const LISTING_SELECTOR = ".catdisplay";
const LISTING_ID_PATTERN = /(?<id>[a-zA-Z]+\s*-\s*\d+\s*-\s*\d+)/;
const ALL_LISTINGS_SUMMARY_PATTERN =
  /Displaying Listing\(s\) 1 to (?<total>\d+) of \k<total> Total Listing\(s\)/;

export class BossGI implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "bossgi";
  baseUrl = "https://bbms.info/";
  path = "/cgi-bin/a-bus2.asp?folder=bbf-4110&src=bus-all";

  getContainerLocator(page: Page): Locator {
    return page.locator(LISTING_SELECTOR).locator("xpath=ancestor::tbody[1]");
  }

  async getTitle(container: Locator): Promise<string | null> {
    return (
      (await container.textContent())?.split(/\s+/).join(" ").trim() || null
    );
  }

  async getHref(_: Locator): Promise<string | null> {
    return new URL(this.path, this.baseUrl).toString();
  }

  async getId({ title }: IdSearchContext): Promise<string> {
    if (!title) {
      throw new Error("Title is required to extract ID");
    }

    const match = title.match(LISTING_ID_PATTERN);
    if (!match || !match.groups) {
      throw new Error(`ID format not recognized: ${title}`);
    }
    return match.groups.id.replace(/\s+/g, "");
  }

  private async waitForInitialResults(
    page: Page,
    startSearchButton: Locator,
    firstListing: Locator,
  ): Promise<void> {
    const searchFormReady = (async () => {
      await startSearchButton.waitFor({
        state: "attached",
        timeout: BOSS_GI_PAGE_TIMEOUT_MS,
      });
      return startSearchButton;
    })();

    const listingsReady = (async () => {
      await firstListing.waitFor({
        state: "attached",
        timeout: BOSS_GI_PAGE_TIMEOUT_MS,
      });
      return null;
    })();

    const buttonToClick = await Promise.race([searchFormReady, listingsReady]);
    if (!buttonToClick) return;

    await Promise.all([
      page.waitForURL(/\/cgi-bin\/a-bus2ff\.asp\?forsale=go/, {
        timeout: BOSS_GI_PAGE_TIMEOUT_MS,
      }),
      buttonToClick.click(),
    ]);
  }

  private async waitForAllListings(page: Page): Promise<void> {
    await page.waitForFunction(
      ({ firstPageSize, listingSelector, summaryPatternSource }) => {
        const text = document.body.textContent?.replace(/\s+/g, " ") ?? "";
        const summaryPattern = new RegExp(summaryPatternSource);
        const match = text.match(summaryPattern);
        if (!match?.groups?.total) return false;

        const total = Number(match.groups.total);
        return (
          total > firstPageSize &&
          document.querySelectorAll(listingSelector).length === total
        );
      },
      {
        firstPageSize: BOSS_GI_FIRST_PAGE_SIZE,
        listingSelector: LISTING_SELECTOR,
        summaryPatternSource: ALL_LISTINGS_SUMMARY_PATTERN.source,
      },
      { timeout: BOSS_GI_PAGE_TIMEOUT_MS },
    );
  }

  async onPageLoad(page: Page): Promise<void> {
    const startSearchButton = page.locator(START_SEARCH_SELECTOR).first();
    const firstListing = page.locator(LISTING_SELECTOR).first();

    await this.waitForInitialResults(page, startSearchButton, firstListing);
    await firstListing.waitFor({
      state: "attached",
      timeout: BOSS_GI_PAGE_TIMEOUT_MS,
    });

    const displayAllButton = page.locator(DISPLAY_ALL_SELECTOR).first();
    if ((await displayAllButton.count()) > 0) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded"),
        displayAllButton.click(),
      ]);
      await this.waitForAllListings(page);
      await firstListing.waitFor({
        state: "attached",
        timeout: BOSS_GI_PAGE_TIMEOUT_MS,
      });
    }
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
