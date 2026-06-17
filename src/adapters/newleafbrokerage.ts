import { createHash } from "node:crypto";
import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";

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
    const response = await fetch(WORDPRESS_PAGE_URL);
    if (!response.ok) {
      throw new Error(
        `New Leaf WordPress page request failed: ${response.status} ${response.statusText}`,
      );
    }

    const page = (await response.json()) as NewLeafWordPressPage;
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

  for (const block of extractClassBlocks(html, LISTING_BOX_CLASS)) {
    const titleBlock = extractFirstClassBlock(block, LISTING_TITLE_CLASS);
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
  const descriptionBlocks = extractClassBlocks(block, DESCRIPTION_NAME_CLASS);
  for (const descriptionBlock of descriptionBlocks) {
    if (
      !INTERNAL_ID_LABEL_PATTERN.test(cleanText(stripTags(descriptionBlock)))
    ) {
      continue;
    }

    const afterLabel = block.slice(block.indexOf(descriptionBlock));
    const valueBlock = extractFirstClassBlock(
      afterLabel,
      DESCRIPTION_VALUE_CLASS,
    );
    const value = valueBlock ? cleanText(stripTags(valueBlock)) : "";
    return value || null;
  }

  return null;
}

function extractFirstClassBlock(
  html: string,
  className: string,
): string | null {
  return extractClassBlocks(html, className)[0] ?? null;
}

function extractClassBlocks(html: string, className: string): string[] {
  const blocks: string[] = [];
  const tagPattern = /<\/?div\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  let start = -1;
  let depth = 0;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[0];
    const isClosingTag = /^<\//.test(tag);

    if (start === -1) {
      if (!isClosingTag && hasClass(tag, className)) {
        start = match.index;
        depth = 1;
      }
      continue;
    }

    depth += isClosingTag ? -1 : 1;
    if (depth === 0) {
      blocks.push(html.slice(start, tagPattern.lastIndex));
      start = -1;
    }
  }

  return blocks;
}

function hasClass(tag: string, className: string): boolean {
  const classMatch = tag.match(/\bclass=(["'])(?<value>.*?)\1/i);
  const classValue = classMatch?.groups?.value;
  if (!classValue) {
    return false;
  }

  return classValue.split(/\s+/).includes(className);
}

function extractHref(html: string): string | null {
  const hrefMatch = html.match(/\bhref=(["'])(?<href>.*?)\1/i);
  return hrefMatch?.groups?.href ?? null;
}

function cleanText(text: string): string {
  return decodeHtml(text).replace(/\s+/g, " ").trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#(?<code>\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x(?<code>[0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
