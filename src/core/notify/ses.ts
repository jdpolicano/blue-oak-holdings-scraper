import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Listing } from "../models/listing.js";
import { BaseNotifier } from "./base.js";
import { Notifier } from "./index.js";
import { Logger } from "pino";

const ses = new SESClient({});

export class SESNotifier extends BaseNotifier implements Notifier {
  private logger: Logger;
  private recipients: string[];
  private sender: string;

  constructor(sender: string, recipients: string[], logger: Logger) {
    super();
    this.sender = sender;
    this.recipients = recipients;
    this.logger = logger.child({ component: SESNotifier.name });
  }
  async notify(listings: Listing[]): Promise<void> {
    if (!listings.length) {
      this.logger.info("No new listings to notify.");
      return;
    }

    const { html, text } = await this.buildPayloads(listings);

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
}
