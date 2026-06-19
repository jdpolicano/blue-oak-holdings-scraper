import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "../core/adapters/base.js";

export class LisitenAssociates implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "lisitenassociates";
  baseUrl = "https://lisitenassociates.com/";
  path = "/exclusive-listings/businesses-and-corporations";

  getContainerLocator(page: Page): Locator {
    return page.locator(".listing");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const title = await container.locator("a.listing-title-link").textContent();
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator("a.listing-title-link").getAttribute("href");
  }

  async getId({ container, href }: IdSearchContext): Promise<string> {
    const idText = await container.locator(".rightcol").textContent();
    if (!idText) return href;
    const idMatch = idText.match(/Listing ID:\s*(?<id>[a-zA-Z]+\d+)/i);
    if (!idMatch?.groups?.id) return href;
    return idMatch.groups.id.trim();
  }

  async onPageLoad(page: Page): Promise<void> {
    const closeButton = page.getByRole("button", { name: "Close" });
    if (!(await closeButton.isVisible())) return;
    await page.getByRole("button", { name: "Close" }).click();
  }

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl);
    return [url.toString()];
  }
}
