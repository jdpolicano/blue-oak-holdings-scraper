import { Page, Locator } from "playwright";
import {
  BasePageObjectPaginated,
  IdSearchContext,
  SiteStrategy,
} from "./base.js";

export class GottesmanCompany implements BasePageObjectPaginated {
  siteStrategy: SiteStrategy.Paginated = SiteStrategy.Paginated;
  site = "gottesmancompany";
  baseUrl = "https://gottesman-company.com/opportunities/list/";
  path = "/opportunities/list";

  getContainerLocator(page: Page): Locator {
    return page.locator(".clickable-row");
  }

  async getTitle(container: Locator): Promise<string | null> {
    const industry = await container.locator(".seller-industry").textContent();
    const id = await container.locator(".seller-id a").textContent();
    const title = industry && id ? `${industry.trim()}: ${id.trim()}` : null;
    if (!title) return null;
    return title.trim();
  }

  async getHref(container: Locator): Promise<string | null> {
    return container.locator(".seller-id a").first().getAttribute("href");
  }

  async getId({ container, href }: IdSearchContext): Promise<string> {
    const idText = await container
      .locator(".seller-id a")
      .first()
      .textContent();

    if (!idText) return href;
    // we split and join to normalize whitespace. Sometimes it seems the id has two spaces in it or one space and one non-breaking space
    const normalizedIdText = idText.replaceAll("\u00A0", " ");
    return normalizedIdText.split(" ").filter(Boolean).join(" ").trim();
  }

  async onPageLoad(page: Page): Promise<void> {}

  async getUrls(_: Page): Promise<string[]> {
    const url = new URL(this.path, this.baseUrl).toString();
    return [url];
  }
}
