import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "../core/adapters/base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  extractClassBlocks,
  extractHref,
  fetchJson,
  hash,
  stripTags,
} from "../core/adapters/html.js";

const WORDPRESS_PAGE_URL =
  "https://inbargroup.com/wp-json/wp/v2/pages/562026?context=view";
const VIEW_COUNT = "562572";
const LISTING_BOX_CLASS = "listing-box";
const LISTING_TITLE_CLASS = "listing-title";
const LISTING_ID_PATTERN =
  /<span\b[^>]*\bclass=(["'])description-name\1[^>]*>\s*Listing ID:\s*<\/span>\s*<span\b[^>]*\bclass=(["'])description-value\2[^>]*>(?<id>.*?)<\/span>/is;

interface InbarWordPressPage {
  content?: {
    rendered?: string;
  };
}

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
  sourceUrl: string;
}

export class InbarGroup implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "inbargroup";
  baseUrl = "https://inbargroup.com/";
  path = "/businesses-for-sale";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const firstPage = await fetchWordPressPage(WORDPRESS_PAGE_URL);
    const firstPageHtml = getRenderedHtml(firstPage, WORDPRESS_PAGE_URL);
    const maxPages = extractMaxPages(firstPageHtml);
    const sourceUrls = getSourceUrls(maxPages);
    const parsedListings = parseListings(firstPageHtml, sourceUrls[0], logger);

    for (const sourceUrl of sourceUrls.slice(1)) {
      const page = await fetchWordPressPage(sourceUrl);
      parsedListings.push(
        ...parseListings(getRenderedHtml(page, sourceUrl), sourceUrl, logger),
      );
    }

    const date = new Date().toISOString();
    const listings = dedupe(parsedListings).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length, pages: sourceUrls.length },
      "Fetched Inbar listings from WordPress API",
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
      url: listing.sourceUrl,
      title: listing.title,
      href: href.toString(),
      listingId,
      id: hash(listingId),
    };
  }
}

async function fetchWordPressPage(url: string): Promise<InbarWordPressPage> {
  return fetchJson<InbarWordPressPage>(url);
}

function getRenderedHtml(page: InbarWordPressPage, url: string): string {
  const html = page.content?.rendered;
  if (!html) {
    throw new Error(
      `Inbar WordPress page response did not include rendered content: ${url}`,
    );
  }

  return html;
}

function getSourceUrls(maxPages: number): string[] {
  const urls = [WORDPRESS_PAGE_URL];

  for (let page = 2; page <= maxPages; page += 1) {
    const url = new URL(WORDPRESS_PAGE_URL);
    url.searchParams.set("wpv_view_count", VIEW_COUNT);
    url.searchParams.set("wpv_paged", String(page));
    urls.push(url.toString());
  }

  return urls;
}

function extractMaxPages(html: string): number {
  const maxPagesMatch = html.match(
    /\bdata-maxpages=(["'])(?<maxPages>\d+)\1/i,
  );
  const maxPages = Number(maxPagesMatch?.groups?.maxPages ?? 1);
  return Number.isFinite(maxPages) && maxPages > 0 ? maxPages : 1;
}

function parseListings(
  html: string,
  sourceUrl: string,
  logger: Logger,
): ParsedListing[] {
  const listings: ParsedListing[] = [];

  for (const block of extractClassBlocks(html, "div", LISTING_BOX_CLASS)) {
    const titleBlock =
      extractClassBlocks(block, "div", LISTING_TITLE_CLASS)[0] ?? "";
    const hrefText = extractHref(titleBlock);
    const title = cleanText(stripTags(titleBlock)) || null;

    if (!hrefText) {
      logger.warn(
        { title, sourceUrl },
        "Missing Inbar listing href, skipping listing",
      );
      continue;
    }

    listings.push({
      title,
      hrefText,
      rawId: extractListingId(block) ?? normalizeHrefId(hrefText),
      sourceUrl,
    });
  }

  return listings;
}

function extractListingId(block: string): string | null {
  const id = block.match(LISTING_ID_PATTERN)?.groups?.id;
  return id ? cleanText(stripTags(id)) : null;
}

function normalizeHrefId(hrefText: string): string {
  const href = new URL(hrefText, "https://inbargroup.com/");
  href.hash = "";
  href.search = "";
  return href.pathname.replace(/\/+$/, "") || "/";
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
