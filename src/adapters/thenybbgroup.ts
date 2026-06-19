import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "../core/adapters/base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  extractClassBlocks,
  extractHref,
  fetchText,
  hash,
  stripTags,
} from "../core/adapters/html.js";

const LISTINGS_URL = "https://thenybbgroup.com/businesses-for-sale/";

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class TheNYBBGroup implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "thenybbgroup";
  baseUrl = "https://thenybbgroup.com/";
  path = "/businesses-for-sale/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const html = await fetchText(LISTINGS_URL);
    const date = new Date().toISOString();
    const listings = parseListings(html, logger).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      "Fetched The NYBB Group listings from rendered HTML",
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

  for (const block of extractClassBlocks(html, "div", "list-post")) {
    const headingMatch = block.match(/<h2\b[^>]*>(?<heading>.*?)<\/h2>/is);
    const heading = headingMatch?.groups?.heading ?? "";
    const hrefText = extractHref(heading) ?? extractHref(block);
    const title = heading ? cleanText(stripTags(heading)) : null;
    const rawId = hrefText ? new URL(hrefText, LISTINGS_URL).pathname : null;

    if (!rawId || !hrefText) {
      logger.warn({ rawId, hrefText, title }, "Skipping malformed NYBB listing");
      continue;
    }

    if (seen.has(rawId)) {
      continue;
    }
    seen.add(rawId);

    listings.push({
      title,
      hrefText,
      rawId,
    });
  }

  return listings;
}
