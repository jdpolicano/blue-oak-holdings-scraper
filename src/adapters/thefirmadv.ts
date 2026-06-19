import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  extractAttribute,
  extractAttributeBlocks,
  extractHref,
  fetchText,
  hash,
  stripTags,
} from "./html.js";

const LISTINGS_URL =
  "https://www.thefirmadv.com/business-buyer/opportunities/";

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class TheFirmAdv implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "thefirmadv";
  baseUrl = "https://www.thefirmadv.com/";
  path = "/business-buyer/opportunities/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const html = await fetchText(LISTINGS_URL);
    const date = new Date().toISOString();
    const listings = parseListings(html, logger).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      "Fetched The Firm Advisors listings from rendered HTML",
    );

    return listings;
  }

  private makeListing(listing: ParsedListing, date: string): Listing {
    const listingId = `${this.site}:${listing.rawId}`;
    const href = new URL(listing.hrefText, this.baseUrl).toString();

    return {
      date,
      site: this.site,
      url: LISTINGS_URL,
      title: listing.title,
      href,
      listingId,
      id: hash(listingId),
    };
  }
}

function parseListings(html: string, logger: Logger): ParsedListing[] {
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();

  for (const block of extractAttributeBlocks(html, "li", "data-listingid")) {
    const rawId = extractAttribute(block, "data-listingid");
    const hrefText = extractHref(block);
    const title =
      extractAttribute(block, "data-alpha") ??
      extractAttribute(block, "title") ??
      cleanText(stripTags(block));

    if (!rawId || !hrefText) {
      logger.warn({ rawId, hrefText, title }, "Skipping malformed The Firm listing");
      continue;
    }

    if (seen.has(rawId)) {
      continue;
    }
    seen.add(rawId);

    listings.push({
      title: title || null,
      hrefText,
      rawId,
    });
  }

  return listings;
}
