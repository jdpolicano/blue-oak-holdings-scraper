// page.ts
import { Page, Locator } from "playwright";
import { Listing } from "../models/listing.js";
import { Logger } from "pino";
import {
  BasePageObjectPaginated,
  // BaseScrapeObject,
  // BasePageObjectCommon,
} from "../../adapters/base.js";
import { createHash } from "node:crypto";
import retry from "p-retry";

export class PageRunner {
  private retries = 5;
  private timeout = 3_500;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: PageRunner.name });
  }

  private hash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private async waitForElementArray(loc: Locator): Promise<Locator[]> {
    // wait for the first element to appear
    try {
      await loc.first().waitFor({ state: "attached", timeout: 60_000 });
      const count = await loc.count();
      return Array.from({ length: count }).map((_, i) => loc.nth(i));
    } catch (e) {
      this.logger.error(e, "waitForElementArray failed");
      return [];
    }
  }

  async getListingsPaginated(
    page: Page,
    siteUrl: string,
    siteHandle: BasePageObjectPaginated,
  ): Promise<Listing[]> {
    if (page.isClosed()) {
      throw new Error("Page is closed before starting getListingsPaginated");
    }
    return retry(
      async () => {
        await Promise.all([
          siteHandle.onPageLoad(page),
          page.goto(siteUrl, { waitUntil: "domcontentloaded" }),
        ]);

        const containers = await this.waitForElementArray(
          siteHandle.getContainerLocator(page),
        );
        if (!containers.length) {
          throw new Error("No containers found");
        }

        const date = new Date().toISOString();
        const url = page.url();

        const listings = await Promise.all(
          containers.map(async (container) => {
            const title = await siteHandle.getTitle(container);
            if (!title) {
              this.logger.warn("Missing title field");
            } else {
              this.logger.debug({ title }, "Found listing title");
            }

            const href = await siteHandle.getHref(container);
            if (!href) {
              this.logger.error({ title }, "Missing href field");
              throw new Error("Missing href field");
            } else {
              this.logger.debug({ title, href }, "Found listing href");
            }

            const resolvedHref = new URL(href, siteHandle.baseUrl).toString();
            const idString = siteHandle.getIdString
              ? await siteHandle.getIdString(
                  page,
                  container,
                  title,
                  resolvedHref,
                )
              : resolvedHref;
            const id = this.hash(idString);

            return {
              date,
              site: siteHandle.baseUrl,
              url,
              title,
              href: resolvedHref,
              id,
            };
          }),
        );

        return listings;
      },
      {
        onFailedAttempt: (ctx) => {
          this.logger.warn(ctx);
        },
        shouldRetry: async (_) => {
          return !page.isClosed();
        },
        retries: this.retries,
        minTimeout: this.timeout,
      },
    );
  }
}
