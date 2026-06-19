import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "../core/adapters/base.js";
import { Listing } from "../core/models/listing.js";
import {
  cleanText,
  decodeHtml,
  extractClassBlocks,
  extractHref,
  fetchJson,
  hash,
  stripTags,
} from "../core/adapters/html.js";

const LISTING_BOX_CLASS = "listingBox";
const LISTING_TITLE_CLASS = "listingTitle";
const DESCRIPTION_NAME_CLASS = "descriptionName";
const DESCRIPTION_VALUE_CLASS = "descriptionValue";
const INTERNAL_ID_LABEL_PATTERN = /Internal ID:/i;
const WORDPRESS_PAGE_URL =
  "https://newleafbrokerage.com/wp-json/wp/v2/pages/456401?context=view";

interface NewLeafWordPressPage {
  content?: {
    rendered?: string;
  };
}

interface ParsedListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export class NewLeafBrokerage implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "newleafbrokerage";
  baseUrl = "https://newleafbrokerage.com/";
  path = "/bb/businesses-for-sale";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const page = await fetchJson<NewLeafWordPressPage>(WORDPRESS_PAGE_URL);
    const html = page.content?.rendered;
    if (!html) {
      throw new Error(
        "New Leaf WordPress page response did not include rendered content",
      );
    }

    const date = new Date().toISOString();
    const listings = parseListings(html, logger).map((listing) =>
      this.makeListing(listing, date),
    );

    logger.info(
      { total: listings.length },
      "Fetched New Leaf listings from WordPress API",
    );

    return listings;
  }

  private makeListing(listing: ParsedListing, date: string): Listing {
    const listingId = `${this.site}:${listing.rawId}`;
    const href = new URL(listing.hrefText, this.baseUrl).toString();

    return {
      date,
      site: this.site,
      url: WORDPRESS_PAGE_URL,
      title: listing.title,
      href,
      listingId,
      id: hash(listingId),
    };
  }
}

function parseListings(html: string, logger: Logger): ParsedListing[] {
  const listings: ParsedListing[] = [];

  for (const block of extractClassBlocks(html, "div", LISTING_BOX_CLASS)) {
    const titleBlock =
      extractClassBlocks(block, "div", LISTING_TITLE_CLASS)[0] ?? null;
    const hrefText = titleBlock ? extractHref(titleBlock) : null;
    const title = titleBlock ? cleanText(stripTags(titleBlock)) || null : null;

    if (!hrefText) {
      logger.warn({ title }, "Missing New Leaf listing href, skipping listing");
      continue;
    }

    listings.push({
      title,
      hrefText: decodeHtml(hrefText),
      rawId: extractInternalId(block) ?? decodeHtml(hrefText),
    });
  }

  return listings;
}

function extractInternalId(block: string): string | null {
  const descriptionBlocks = extractClassBlocks(
    block,
    "span",
    DESCRIPTION_NAME_CLASS,
  );
  for (const descriptionBlock of descriptionBlocks) {
    if (
      !INTERNAL_ID_LABEL_PATTERN.test(cleanText(stripTags(descriptionBlock)))
    ) {
      continue;
    }

    const afterLabel = block.slice(block.indexOf(descriptionBlock));
    const valueBlock = extractClassBlocks(
      afterLabel,
      "span",
      DESCRIPTION_VALUE_CLASS,
    )[0];
    const value = valueBlock ? cleanText(stripTags(valueBlock)) : "";
    return value || null;
  }

  return null;
}
