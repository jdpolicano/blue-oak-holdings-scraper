import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";
import {
  LinkListing,
  fetchText,
  hash,
  parseLinkListings,
} from "./html.js";

export interface StaticListingSource {
  url: string;
  hrefPattern: RegExp;
}

export interface StaticListingOptions {
  site: string;
  baseUrl: string;
  path: string;
  sources: StaticListingSource[];
  logName: string;
}

export abstract class StaticListingsAdapter implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site: string;
  baseUrl: string;
  path: string;

  private readonly sources: StaticListingSource[];
  private readonly logName: string;

  protected constructor(options: StaticListingOptions) {
    this.site = options.site;
    this.baseUrl = options.baseUrl;
    this.path = options.path;
    this.sources = options.sources;
    this.logName = options.logName;
  }

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const parsedListings: LinkListing[] = [];

    for (const source of this.sources) {
      const html = await fetchText(source.url);
      const sourceListings = parseLinkListings(
        html,
        source.hrefPattern,
        this.baseUrl,
      );

      logger.info(
        { url: source.url, count: sourceListings.length },
        `Fetched ${this.logName} source listings`,
      );

      parsedListings.push(...sourceListings);
    }

    const date = new Date().toISOString();
    const listings = this.dedupe(parsedListings).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      `Fetched ${this.logName} listings from static HTML`,
    );

    return listings;
  }

  private makeListing(listing: LinkListing, date: string): Listing {
    const href = new URL(listing.hrefText, this.baseUrl);
    href.hash = "";
    const listingId = `${this.site}:${listing.rawId}`;

    return {
      date,
      site: this.site,
      url: this.sources[0]?.url ?? this.baseUrl,
      title: listing.title,
      href: href.toString(),
      listingId,
      id: hash(listingId),
    };
  }

  private dedupe(listings: LinkListing[]): LinkListing[] {
    const seen = new Set<string>();
    return listings.filter((listing) => {
      if (seen.has(listing.rawId)) {
        return false;
      }
      seen.add(listing.rawId);
      return true;
    });
  }
}
