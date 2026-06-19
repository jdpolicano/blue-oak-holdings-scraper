import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  extractClassBlocks,
  extractHref,
  fetchText,
  hash,
  stripTags,
} from "./html.js";

const LISTINGS_URL = "https://www.jackimwoods.com/active-engagements/";
const LISTING_ID_PATTERN =
  /Listing ID:\s*<\/span>\s*<span\b[^>]*class=(["'])description-value\1[^>]*>(?<id>.*?)<\/span>/is;

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class JackimWoods implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "jackimwoods";
  baseUrl = "https://www.jackimwoods.com/";
  path = "/active-engagements/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const html = await fetchText(LISTINGS_URL);
    const date = new Date().toISOString();
    const listings = parseListings(html, logger).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      "Fetched Jackim Woods listings from rendered HTML",
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

  for (const block of extractClassBlocks(html, "div", "listing-box")) {
    const titleBlock = extractClassBlocks(block, "div", "listing-title")[0];
    const hrefText = titleBlock ? extractHref(titleBlock) : null;
    const title = titleBlock ? cleanText(stripTags(titleBlock)) : null;
    const rawId = extractListingId(block) ?? hrefText;

    if (!rawId || !hrefText) {
      logger.warn({ rawId, hrefText, title }, "Skipping malformed Jackim Woods listing");
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

function extractListingId(block: string): string | null {
  const match = block.match(LISTING_ID_PATTERN);
  const id = match?.groups?.id ? cleanText(stripTags(match.groups.id)) : "";
  return id || null;
}
