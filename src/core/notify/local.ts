import { Listing } from "../models/listing.js";
import { ScrapingError } from "../models/error.js";
import { Notifier } from "./index.js";
import { buildListingPayloads, buildErrorPayloads } from "./helpers.js";
import { Logger } from "pino";

/**
 * LocalNotifier logs notifications to the console for development/debugging.
 */
export class LocalNotifier implements Notifier {
  private readonly logger: Logger;

  /**
   * @param logger - Logger instance for structured logging
   */
  constructor(logger: Logger) {
    this.logger = logger.child({ component: LocalNotifier.name });
  }

  /**
   * Logs new listings to the console.
   * @param listings - Array of new listings to notify about
   */
  async notify(listings: Listing[]): Promise<void> {
    if (!listings.length) {
      this.logger.info("No new listings to notify.");
      return;
    }

    const { html, text } = await buildListingPayloads(listings);

    this.logger.info(`New Listings HTML: ${html}`);
    this.logger.info(`New Listings Text: ${text}`);
  }

  /**
   * Logs scraping errors to the console.
   * @param errors - Array of scraping errors to notify about
   */
  async notifyScrapingErrors(errors: ScrapingError[]): Promise<void> {
    if (!errors.length) {
      this.logger.info("No scraping errors to notify.");
      return;
    }

    const { html, text } = await buildErrorPayloads(errors);

    this.logger.info(`Scraping Errors HTML: ${html}`);
    this.logger.info(`Scraping Errors Text: ${text}`);
  }
}
