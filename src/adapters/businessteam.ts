import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  extractAttribute,
  extractClassBlocks,
  extractHref,
  fetchText,
  hash,
  stripTags,
} from "./html.js";

const LISTINGS_URL =
  "https://www.business-team.com/buy-a-business/search-results.aspx?lid=all";

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class BusinessTeam implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "businessteam";
  baseUrl = "https://www.business-team.com/";
  path = "/buy-a-business/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const html = await fetchText(LISTINGS_URL);
    const date = new Date().toISOString();
    const listings = parseListings(html, logger).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      "Fetched Business Team listings from search results",
    );

    return listings;
  }

  private makeListing(listing: ParsedListing, date: string): Listing {
    const href = new URL(listing.hrefText, this.baseUrl);
    href.hash = "";
    const listingId = `${this.site}:${listing.rawId}`;

    return {
      date,
      site: this.site,
      url: LISTINGS_URL,
      title: listing.title,
      href: href.toString(),
      listingId,
      id: hash(listingId),
    };
  }
}

function parseListings(html: string, logger: Logger): ParsedListing[] {
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();

  for (const block of extractClassBlocks(html, "div", "listing_wrap")) {
    const hrefText = extractHref(block);
    const rawId = hrefText ? new URL(hrefText).searchParams.get("LID") : null;
    const titleBlock = block.match(/<h3\b[^>]*>(?<title>.*?)<\/h3>/is)
      ?.groups?.title;
    const title =
      (titleBlock ? cleanText(stripTags(titleBlock)) : null) ??
      extractAttribute(block, "alt");

    if (!hrefText || !rawId) {
      logger.warn({ hrefText, rawId, title }, "Skipping malformed Business Team listing");
      continue;
    }

    if (seen.has(rawId)) {
      continue;
    }
    seen.add(rawId);
    listings.push({ title, hrefText, rawId });
  }

  return listings;
}
