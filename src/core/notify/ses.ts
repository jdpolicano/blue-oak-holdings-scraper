import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Listing } from "../models/listing.js";
import { ScrapingError } from "../models/error.js";
import { BaseNotifier } from "./base.js";
import { Notifier } from "./index.js";
import { Logger } from "pino";

// Initialize the AWS SES client. This is used to send emails.
const ses = new SESClient({});

/**
 * SESNotifier is responsible for sending email notifications about new listings
 * using AWS Simple Email Service (SES).
 */
export class SESNotifier extends BaseNotifier implements Notifier {
  private logger: Logger; // Logger instance for structured logging.
  private recipients: string[]; // List of email addresses to notify.
  private sender: string; // Email address from which notifications are sent.

  /**
   * Constructor for SESNotifier.
   * @param sender - The email address that will appear as the sender of the notifications.
   * @param recipients - An array of email addresses that will receive the notifications.
   * @param logger - A logger instance for logging information and errors.
   */
  constructor(sender: string, recipients: string[], logger: Logger) {
    super();
    this.sender = sender;
    this.recipients = recipients;
    this.logger = logger.child({ component: SESNotifier.name }); // Create a child logger with the component name.
  }

  /**
   * Sends notifications about new listings via email.
   * @param listings - An array of Listing objects representing the new listings to notify about.
   * If the array is empty, no email will be sent.
   */
  async notify(listings: Listing[]): Promise<void> {
    if (!listings.length) {
      this.logger.info("No new listings to notify."); // Log if there are no listings to notify about.
      return;
    }

    // Build the email payloads (HTML and plain text versions) for the listings.
    const { html, text } = await this.buildPayloads(listings);

    // Send the email using AWS SES.
    await ses.send(
      new SendEmailCommand({
        Destination: { ToAddresses: this.recipients }, // Recipients of the email.
        Message: {
          Subject: { Data: "New Listings Available" }, // Subject line of the email.
          Body: {
            Html: { Data: html }, // HTML version of the email body.
            Text: { Data: text }, // Plain text version of the email body.
          },
        },
        Source: this.sender, // Sender email address.
      }),
    );

    // Log the successful sending of the notification.
    this.logger.info(`Sent notification for ${listings.length} new listings.`);
  }

  /**
   * Sends notifications about scraping errors via email.
   * @param errors - An array of ScrapingError objects representing the scraping errors to notify about.
   * If the array is empty, no email will be sent.
   */
  async notifyScrapingErrors(errors: ScrapingError[]): Promise<void> {
    if (!errors.length) {
      this.logger.info("No scraping errors to notify."); // Log if there are no errors to notify about.
      return;
    }

    // Build the email payloads (HTML and plain text versions) for the errors.
    const { html, text } = await this.buildErrorPayloads(errors);

    // Send the email using AWS SES.
    await ses.send(
      new SendEmailCommand({
        Destination: { ToAddresses: this.recipients }, // Recipients of the email.
        Message: {
          Subject: { 
            Data: `🚨 Scraping Errors Detected (${errors.length} across ${[...new Set(errors.map(e => e.site))].length} sites)` 
          }, // Subject line of the email.
          Body: {
            Html: { Data: html }, // HTML version of the email body.
            Text: { Data: text }, // Plain text version of the email body.
          },
        },
        Source: this.sender, // Sender email address.
      }),
    );

    // Log the successful sending of the notification.
    this.logger.info(`Sent scraping error notification for ${errors.length} errors.`);
  }
}
