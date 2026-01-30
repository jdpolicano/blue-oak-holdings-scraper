import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class CalhounCompanies implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "calhouncompanies";
  baseUrl = "https://www.calhouncompanies.com/";
  path = "/find-a-business";

  getContainerLocator(page: Page): Locator {
    return page.locator(".node");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.getByRole("heading").first().textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.getAttribute("href");
  }

  async getId({ title, href }: IdSearchContext): Promise<string> {
    const idMatch = title?.match(/- (?<id>\d{5} [a-z/A-Z]+)$/);
    if (!idMatch?.groups?.id) {
      return href;
    }
    return idMatch.groups.id.trim();
  }

  async waitForAjaxSpinnerToDisappear(page: Page): Promise<void> {
    const ajaxSpinner = page.locator(".ajax-progress.ajax-progress-fullscreen");
    const isVisibleSafe = (sel: Locator) => sel.isVisible().catch(() => false);
    while (await isVisibleSafe(ajaxSpinner)) {}
  }

  async onPageLoad(page: Page): Promise<void> {
    return this.waitForAjaxSpinnerToDisappear(page);
  }

  async getUrls(page: Page): Promise<string[]> {
    const searchPage = new URL(this.path, this.baseUrl).toString();
    const nextButton = page.getByRole("link", { name: "Next page" });
    const ajaxSpinner = page.locator(".ajax-progress.ajax-progress-fullscreen");
    const selectCashFlow = async (hasText: string) => {
      await page.getByRole("textbox", { name: "Select One" }).nth(3).click();
      await page.locator("span").filter({ hasText }).click();
      return page.getByRole("button", { name: "Search Businesses" }).click();
    };
    const isVisibleSafe = (sel: Locator) => sel.isVisible().catch(() => false);
    const waitForAjaxSpinnerToDisappear = async () => {
      while (await isVisibleSafe(ajaxSpinner)) {}
    };
    const urls = [];
    for (const filter of ["500k to 1m", "1m to 2m", "2m to 3m", "> 3m"]) {
      await page.goto(searchPage);
      await waitForAjaxSpinnerToDisappear();
      await selectCashFlow(filter);
      await waitForAjaxSpinnerToDisappear();

      if ((await this.getContainerLocator(page).count()) === 0) {
        continue;
      }

      urls.push(page.url());
      // Click "Next page" until it no longer exists
      while (await isVisibleSafe(nextButton)) {
        await nextButton.click();
        await waitForAjaxSpinnerToDisappear();
        urls.push(page.url());
      }
    }
    return urls;
  }
}
