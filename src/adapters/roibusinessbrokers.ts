import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "../core/adapters/base.js";
import { Listing } from "../core/models/listing.js";
import { cleanText, fetchJson, hash, stripTags } from "../core/adapters/html.js";

const LISTINGS_API_URL =
  "https://list.roibusinessbrokers.com/wp-json/wp/v2/rtcl_listing?per_page=100";
const LISTINGS_URL = "https://list.roibusinessbrokers.com/featured-listings/";

interface RoiListingPost {
  id: number;
  link?: string;
  title?: {
    rendered?: string;
  };
}

export class RoiBusinessBrokers implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "roibusinessbrokers";
  baseUrl = "https://list.roibusinessbrokers.com/";
  path = "/featured-listings/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const posts = await fetchJson<RoiListingPost[]>(LISTINGS_API_URL);
    const date = new Date().toISOString();
    const listings = posts.flatMap((post) => {
      if (!post.link) {
        logger.warn({ postId: post.id }, "Skipping malformed ROI listing");
        return [];
      }

      return [this.makeListing(post, date)];
    });

    logger.info(
      { total: listings.length },
      "Fetched ROI Business Brokers listings from WordPress API",
    );

    return listings;
  }

  private makeListing(post: RoiListingPost, date: string): Listing {
    const listingId = `${this.site}:${post.id}`;
    return {
      date,
      site: this.site,
      url: LISTINGS_URL,
      title: post.title?.rendered
        ? cleanText(stripTags(post.title.rendered))
        : null,
      href: post.link!,
      listingId,
      id: hash(listingId),
    };
  }
}
