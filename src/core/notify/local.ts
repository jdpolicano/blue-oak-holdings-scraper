import { Listing } from "../models/listing.js";
import { BaseNotifier } from "./base.js";
import { Notifier } from "./index.js";
import { Logger } from "pino";

/**
 * LocalNotifier is a concrete implementation of the Notifier interface.
 * It is responsible for handling notifications locally, such as logging
 * new listings to the console or a file.
 */
export class LocalNotifier extends BaseNotifier implements Notifier {
  private logger: Logger;

  /**
   * Constructor for LocalNotifier.
   * @param logger - An instance of the Pino logger used for structured logging.
   * The logger is scoped to the LocalNotifier component for better traceability.
   */
  constructor(logger: Logger) {
    super();
    this.logger = logger.child({ component: LocalNotifier.name });
  }

  /**
   * Notify method processes a list of new listings and logs the notification payloads.
   * @param listings - An array of Listing objects representing new listings to notify about.
   * If the array is empty, a message is logged indicating no new listings.
   * Otherwise, the method builds HTML and text payloads for the listings and logs them.
   */
  async notify(listings: Listing[]): Promise<void> {
    if (!listings.length) {
      this.logger.info("No new listings to notify.");
      return;
    }

    // Build the notification payloads (HTML and plain text) for the listings.
    const { html, text } = await this.buildPayloads(listings);

    // Log the generated notification payloads for debugging or auditing purposes.
    this.logger.info(`New Listings HTML: ${html}`);
    this.logger.info(`New Listings Text: ${text}`);
    return;
  }
}
