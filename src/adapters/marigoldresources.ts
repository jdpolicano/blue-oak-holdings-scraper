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
} from "./html.js";

const LISTINGS_URL = "https://www.marigoldresources.com/for-sale/";
const LISTING_HREF_PATTERN =
  /^https?:\/\/(public\.3\.basecamp\.com|www?\.marigold\.(mobi|com))\//i;

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class MarigoldResources implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "marigoldresources";
  baseUrl = "https://www.marigoldresources.com/";
  path = "/for-sale/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const html = await fetchText(LISTINGS_URL);
    const date = new Date().toISOString();
    const listings = parseListings(html, logger).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      "Fetched Marigold Resources listings from page content",
    );

    return listings;
  }

  private makeListing(listing: ParsedListing, date: string): Listing {
    const href = new URL(listing.hrefText);
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

  for (const block of extractClassBlocks(html, "figure", "wp-block-image")) {
    const hrefText = extractHref(block);
    if (!hrefText || !LISTING_HREF_PATTERN.test(hrefText)) {
      continue;
    }

    const title = extractImageTitle(block);
    pushListing({ hrefText, title }, seen, listings);
  }

  for (const match of html.matchAll(
    /<a\b[^>]*href=(["'])(?<href>https:\/\/public\.3\.basecamp\.com\/p\/[^"']+)\1[^>]*>(?<title>.*?)<\/a>/gis,
  )) {
    const hrefText = match.groups?.href;
    const title = match.groups?.title ? cleanText(match.groups.title) : null;
    if (!hrefText) {
      logger.warn({ title }, "Skipping malformed Marigold Resources listing");
      continue;
    }

    pushListing({ hrefText, title }, seen, listings);
  }

  return listings;
}

function pushListing(
  listing: Omit<ParsedListing, "rawId">,
  seen: Set<string>,
  listings: ParsedListing[],
): void {
  const rawId = new URL(listing.hrefText).toString().replace(/#.*$/, "");
  if (seen.has(rawId)) {
    return;
  }

  seen.add(rawId);
  listings.push({ ...listing, rawId });
}

function extractImageTitle(block: string): string | null {
  const alt = extractAttribute(block, "alt");
  if (alt) {
    return cleanText(alt);
  }

  const src = extractAttribute(block, "src");
  if (!src) {
    return null;
  }

  const filename = new URL(src).pathname.split("/").at(-1) ?? "";
  const basename = filename
    .replace(/\.[^.]+$/, "")
    .replace(/-\d+x\d+$/, "")
    .replace(/[-_]+/g, " ");

  return cleanText(basename);
}
