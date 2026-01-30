import { Listing } from "../models/listing.js";
import { ScrapingError } from "../models/error.js";

export interface Notifier {
  notify(listings: Listing[]): Promise<void>;
  notifyScrapingErrors(errors: ScrapingError[]): Promise<void>;
}

export { LocalNotifier } from "./local.js";
export { SESNotifier } from "./ses.js";
