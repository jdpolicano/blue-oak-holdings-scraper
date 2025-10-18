// page.ts
import { Page, Locator } from "playwright";
import { Listing } from "./listing.js";
import { Logger } from "pino";
import {
  BasePageObjectPaginated,
  BaseScrapeObject,
  BasePageObjectCommon,
} from "../adapters/base.js";
import { createHash } from "node:crypto";
import retry from "p-retry";

export class PageRunner {
  private retries = 5;
  private timeout = 500;

  constructor(private logger: Logger) {}

  private hash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // private async getListingsWithRefresh(page: Page): Promise<Listing[]> {
  //   for (let attempt = 1; attempt <= this.refreshRetries; attempt++) {
  //     const listings = await this.withBackoff(
  //       () => this.getCurrentListings(page),
  //       "getCurrentListings",
  //     );

  //     const duplicate = listings.find(({ id }) => this.seenIds.has(id));
  //     if (!duplicate) {
  //       // no duplicates — record all and return
  //       listings.forEach(({ id }) => this.seenIds.add(id));
  //       return listings;
  //     }

  //     this.logger.warn(
  //       {
  //         duplicateId: duplicate.id,
  //         attempt,
  //         url: page.url(),
  //       },
  //       `Duplicate listing detected, refreshing page (attempt ${attempt}/${this.refreshRetries})`,
  //     );

  //     if (attempt < this.refreshRetries) {
  //       await page.reload({ waitUntil: "domcontentloaded" });
  //       await this.sleep(500 + Math.random() * 300); // add small jitter
  //     } else {
  //       this.fail("Persistent duplicate listings after refresh attempts", {
  //         duplicateId: duplicate.id,
  //         url: page.url(),
  //         title: duplicate.title,
  //       });
  //     }
  //   }

  //   return [];
  // }

  // private async getListingsPaginated(page: Page): Promise<Listing[]> {
  //   while (true) {
  //     const url = page.url();
  //     if (this.seenUrls.has(url)) break;

  //     const listings = await this.getListingsWithRefresh(page);
  //     this.listings.push(...listings);
  //     this.seenUrls.add(url);

  //     const stop = await this.withBackoff(
  //       () => this.site.shouldStop(page),
  //       "shouldStop",
  //     );
  //     if (stop) break;

  //     await this.withBackoff(() => this.site.nextPage(page), "nextPage");
  //   }

  //   return this.listings;
  // }

  async getListingsPaginated(
    page: Page,
    siteUrl: string,
    siteHandle: BasePageObjectPaginated,
  ): Promise<Listing[]> {
    return retry(
      async (attempt) => {
        await Promise.all([
          siteHandle.onPageLoad(page),
          page.goto(siteUrl, { waitUntil: "domcontentloaded" }),
        ]);

        // Add a wait for page load depending on the retry attempt
        if (attempt > 1) {
          const waitTime = (attempt - 1) * this.timeout;
          this.logger.info(
            `Waiting for ${waitTime}ms after retry attempt ${attempt}`,
          );
          await page.waitForTimeout(waitTime);
        }

        const containers = await siteHandle.getContainers(page);
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
              this.logger.info({ title }, "Found listing title");
            }

            const href = await siteHandle.getHref(container);
            if (!href) {
              this.logger.error({ title }, "Missing href field");
              throw new Error("Missing href field");
            } else {
              this.logger.info({ title, href }, "Found listing href");
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
          this.logger.warn({ ctx });
        },
        retries: this.retries,
        minTimeout: this.timeout,
      },
    );
  }

  // async getListings(page: Page, siteUrl: string): Promise<Listing[]> {
  //   this.logger.info(`Navigating to ${this.site.url().toString()}`);
  //   this.seenUrls.clear();
  //   this.seenIds.clear();
  //   this.listings = [];

  //   await page.goto(this.site.url().toString(), {
  //     waitUntil: "domcontentloaded",
  //   });

  //   if (this.site.paginated) {
  //     this.logger.info("Using paginated handler");
  //     //return this.getListingsPaginated(page);
  //   }

  //   this.logger.info("Using standard handler");
  //   return this.getListingsWithRefresh(page);
  // }
}
