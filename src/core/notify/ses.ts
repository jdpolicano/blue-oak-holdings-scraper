import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Listing } from "../models/listing.js";
import { ScrapingError } from "../models/error.js";
import { Notifier } from "./index.js";
import { buildListingPayloads, buildErrorPayloads } from "./helpers.js";
import { Logger } from "pino";

// Initialize the AWS SES client. This is used to send emails.
const ses = new SESClient({});

/**
 * Sends email notifications via AWS SES.
 */
export class SESNotifier implements Notifier {
  private readonly logger: Logger;
  private readonly recipients: string[];
  private readonly sender: string;

  /**
   * @param sender - The email address that will appear as the sender
   * @param recipients - Array of email addresses to receive notifications
   * @param logger - Logger instance for structured logging
   */
  constructor(sender: string, recipients: string[], logger: Logger) {
    this.sender = sender;
    this.recipients = recipients;
    this.logger = logger.child({ component: SESNotifier.name });
  }

  /**
   * Sends notifications about new listings via email.
   * @param listings - Array of new listings to notify about
   */
  async notify(listings: Listing[]): Promise<void> {
    if (!listings.length) {
      this.logger.info("No new listings to notify.");
      return;
    }

    const { html, text } = await buildListingPayloads(listings);

    await ses.send(
      new SendEmailCommand({
        Destination: { ToAddresses: this.recipients },
        Message: {
          Subject: { Data: "New Listings Available" },
          Body: {
            Html: { Data: html },
            Text: { Data: text },
          },
        },
        Source: this.sender,
      }),
    );

    this.logger.info(`Sent notification for ${listings.length} new listings.`);
  }

  /**
   * Sends notifications about scraping errors via email.
   * @param errors - Array of scraping errors to notify about
   */
  async notifyScrapingErrors(errors: ScrapingError[]): Promise<void> {
    if (!errors.length) {
      this.logger.info("No scraping errors to notify.");
      return;
    }

    const { html, text } = await buildErrorPayloads(errors);

    await ses.send(
      new SendEmailCommand({
        Destination: { ToAddresses: this.recipients },
        Message: {
          Subject: {
            Data: `🚨 Scraping Errors Detected (${errors.length} across ${[...new Set(errors.map((e) => e.site))].length} sites)`,
          },
          Body: {
            Html: { Data: html },
            Text: { Data: text },
          },
        },
        Source: this.sender,
      }),
    );

    this.logger.info(
      `Sent scraping error notification for ${errors.length} errors.`,
    );
  }
}
