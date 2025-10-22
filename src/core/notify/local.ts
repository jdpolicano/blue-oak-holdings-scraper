import { Listing } from "../models/listing.js";
import { BaseNotifier } from "./base.js";
import { Notifier } from "./index.js";
import { Logger } from "pino";

export class LocalNotifier extends BaseNotifier implements Notifier {
  private logger: Logger;

  constructor(logger: Logger) {
    super();
    this.logger = logger.child({ component: LocalNotifier.name });
  }

  async notify(listings: Listing[]): Promise<void> {
    if (!listings.length) {
      this.logger.info("No new listings to notify.");
      return;
    }
    const { html, text } = await this.buildPayloads(listings);
    // print notification plan
    this.logger.info(`New Listings HTML: ${html}`);
    this.logger.info(`New Listings Text: ${text}`);
    return;
  }
}
