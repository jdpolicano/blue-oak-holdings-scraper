import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  fetchText,
  hash,
  normalizePath,
  stripTags,
} from "./html.js";

const LISTINGS_URL = "https://alliantbrokers.com/businesses-for-sale-4/";

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class AlliantBrokers implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "alliantbrokers";
  baseUrl = "https://alliantbrokers.com/";
  path = "/businesses-for-sale-4/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const html = await fetchText(LISTINGS_URL);
    const date = new Date().toISOString();
    const listings = parseListings(html, this.baseUrl).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      "Fetched Alliant Brokers listings from static HTML",
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

function parseListings(html: string, baseUrl: string): ParsedListing[] {
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();
  const linkPattern =
    /<a\b(?=[^>]*\bclass=(["'])[^"']*\bsingle-grid\b[^"']*\1)[^>]*\bhref=(["'])(?<href>.*?)\2[^>]*>(?<inner>.*?)<\/a>/gis;

  for (const match of html.matchAll(linkPattern)) {
    const hrefText = match.groups?.href;
    if (!hrefText || !/\/listing\//i.test(hrefText)) {
      continue;
    }

    const href = new URL(hrefText, baseUrl);
    const rawId = normalizePath(href);
    if (seen.has(rawId)) {
      continue;
    }
    seen.add(rawId);

    const inner = match.groups?.inner ?? "";
    const titleMatch = inner.match(/<h2\b[^>]*\bclass=(["'])[^"']*\bpost-title\b[^"']*\1[^>]*>(?<title>.*?)<\/h2>/is);
    const title = titleMatch?.groups?.title
      ? cleanText(stripTags(titleMatch.groups.title))
      : cleanText(stripTags(inner));

    listings.push({
      title: title || null,
      hrefText,
      rawId,
    });
  }

  return listings;
}
