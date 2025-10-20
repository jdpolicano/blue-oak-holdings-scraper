import { Listing } from "../models/listing.js";

export interface Notifier {
  notify(listings: Listing[]): Promise<void>;
}

export { LocalNotifier } from "./local.js";
export { SESNotifier } from "./ses.js";
