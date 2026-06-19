import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "../core/adapters/base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  extractAttribute,
  extractClassBlocks,
  extractHref,
  fetchJson,
  fetchText,
  hash,
  stripTags,
} from "../core/adapters/html.js";

const LISTINGS_URL = "https://earnedexits.com/listings/";
const QUERY_API_URL = "https://earnedexits.com/wp-json/wp/v2/kadence_query/query";
const QUERY_ID = "5229";
const EXCLUDED_PAGE_ID = "3888";

interface KadenceQueryResponse {
  posts?: unknown;
  page?: unknown;
  postCount?: unknown;
  foundPosts?: unknown;
  maxNumPages?: unknown;
}

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class EarnedExits implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "earnedexits";
  baseUrl = "https://earnedexits.com/";
  path = "/listings/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const html = await fetchText(LISTINGS_URL);
    const maxPage = extractMaxPage(html);
    const parsedListings = [...parseListings(html, logger)];

    for (let page = 2; page <= maxPage; page += 1) {
      const response = await fetchQueryPage(page);
      const posts = Array.isArray(response.posts) ? response.posts : [];
      logger.info(
        {
          page,
          count: posts.length,
          foundPosts: response.foundPosts,
          maxNumPages: response.maxNumPages,
        },
        "Fetched Earned Exits Kadence query page",
      );

      parsedListings.push(
        ...posts.flatMap((post) =>
          typeof post === "string" ? parseListings(post, logger) : [],
        ),
      );
    }

    const date = new Date().toISOString();
    const listings = dedupe(parsedListings).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length, maxPage },
      "Fetched Earned Exits listings from Kadence query",
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

  for (const block of extractClassBlocks(html, "li", "kb-query-item")) {
    const titleLinkMatch = block.match(
      /<a\b(?<attrs>[^>]*\bkb-advanced-heading-link\b[^>]*)>\s*<h2\b[^>]*>(?<title>.*?)<\/h2>\s*<\/a>/is,
    );
    const titleBlock = titleLinkMatch?.groups?.title ?? "";
    const hrefText = titleLinkMatch?.groups?.attrs
      ? extractHref(titleLinkMatch.groups.attrs)
      : extractHref(block);
    const rawId = extractPostId(block) ?? (hrefText ? new URL(hrefText).pathname : null);
    const title = titleBlock ? cleanText(stripTags(titleBlock)) : null;

    if (!rawId || !hrefText) {
      logger.warn({ rawId, hrefText, title }, "Skipping malformed Earned Exits listing");
      continue;
    }

    listings.push({ title, hrefText, rawId });
  }

  return listings;
}

function extractMaxPage(html: string): number {
  const dataMax = html.match(/\bdata-max-num-pages=(["'])(?<value>\d+)\1/i);
  const fromData = Number(dataMax?.groups?.value);
  if (Number.isFinite(fromData) && fromData > 0) {
    return fromData;
  }

  const pageNumbers = [...html.matchAll(/\bdata-page=(["'])(?<value>\d+)\1/gi)]
    .map((match) => Number(match.groups?.value))
    .filter((value) => Number.isFinite(value));
  return pageNumbers.length ? Math.max(...pageNumbers) : 1;
}

async function fetchQueryPage(page: number): Promise<KadenceQueryResponse> {
  const url = new URL(QUERY_API_URL);
  url.searchParams.set("pg", page.toString());
  url.searchParams.set("fe", "true");
  url.searchParams.set("ql_id", QUERY_ID);
  url.searchParams.set("fc", "");
  url.searchParams.set("dt", "");
  url.searchParams.set(`${QUERY_ID}_query_exclude_post_id`, EXCLUDED_PAGE_ID);

  return fetchJson<KadenceQueryResponse>(url.toString());
}

function extractPostId(block: string): string | null {
  const tagStart = block.match(/^<li\b[^>]*>/i)?.[0] ?? "";
  const classValue = extractAttribute(tagStart, "class") ?? "";
  const match = classValue.match(/\bpost-(?<id>\d+)\b/);
  return match?.groups?.id ?? null;
}

function dedupe(listings: ParsedListing[]): ParsedListing[] {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    if (seen.has(listing.rawId)) {
      return false;
    }
    seen.add(listing.rawId);
    return true;
  });
}
