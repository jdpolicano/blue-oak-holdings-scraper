import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "../core/adapters/base.js";
import { Listing } from "../core/models/listing.js";
import { cleanText, fetchJson, hash, stripTags } from "../core/adapters/html.js";

const LISTINGS_URL = "https://metrobusinessadvisors.com/business-for-sale/";
const POSTS_API_URL = "https://metrobusinessadvisors.com/wp-json/wp/v2/posts";
const BUSINESS_FOR_SALE_CATEGORY_ID = "42";
const PAGE_SIZE = 100;

interface WordPressPost {
  id?: unknown;
  link?: unknown;
  title?: {
    rendered?: unknown;
  };
  categories?: unknown;
}

export class MetroBusinessAdvisors implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "metrobusinessadvisors";
  baseUrl = "https://metrobusinessadvisors.com/";
  path = "/business-for-sale/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const posts = await fetchAllListingPosts(logger);
    const date = new Date().toISOString();
    const listings = posts.map((post) => this.makeListing(post, date));

    logger.info(
      { total: listings.length },
      "Fetched Metro Business Advisors listings from WordPress API",
    );

    return listings;
  }

  private makeListing(post: WordPressPost, date: string): Listing {
    if (typeof post.id !== "number") {
      throw new Error("Metro Business Advisors post is missing id");
    }
    if (typeof post.link !== "string") {
      throw new Error("Metro Business Advisors post is missing link");
    }

    const listingId = `${this.site}:${post.id}`;

    return {
      date,
      site: this.site,
      url: LISTINGS_URL,
      title:
        typeof post.title?.rendered === "string"
          ? cleanText(stripTags(post.title.rendered))
          : null,
      href: new URL(post.link, this.baseUrl).toString(),
      listingId,
      id: hash(listingId),
    };
  }
}

async function fetchAllListingPosts(logger: Logger): Promise<WordPressPost[]> {
  const listings: WordPressPost[] = [];
  let page = 1;

  while (true) {
    const url = new URL(POSTS_API_URL);
    url.searchParams.set("categories", BUSINESS_FOR_SALE_CATEGORY_ID);
    url.searchParams.set("per_page", PAGE_SIZE.toString());
    url.searchParams.set("page", page.toString());

    const posts = await fetchJson<WordPressPost[]>(url.toString());
    logger.info({ page, count: posts.length }, "Fetched Metro WordPress posts page");

    listings.push(...posts);
    if (posts.length < PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  return listings;
}
