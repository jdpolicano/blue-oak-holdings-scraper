import { createHash } from "node:crypto";
import { Logger } from "pino";
import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";

const ORGANIZATION_ID = "cma5x9m7b00000u91riu4sc13";
const LISTINGS_API_URL = "https://crm.tupelosmb.com/api/public/listings";
const PAGE_SIZE = 100;

interface TupeloListing {
  id?: unknown;
  headline?: unknown;
}

interface TupeloListingsResponse {
  listings?: unknown;
  totalCount?: unknown;
}

export class BristolGroup implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "bristolgroup";
  baseUrl = "https://bristolgrouponline.com/";
  path = "/businesses-for-sale/";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    const listings: Listing[] = [];
    const date = new Date().toISOString();
    let page = 1;
    let totalCount: number | null = null;

    do {
      const response = await this.fetchPage(page);
      totalCount = response.totalCount;

      logger.info(
        {
          page,
          count: response.listings.length,
          totalCount,
        },
        "Fetched Bristol Group listings from Tupelo API",
      );

      listings.push(
        ...response.listings.map((listing) => this.makeListing(listing, date)),
      );
      if (response.listings.length === 0 && listings.length < totalCount) {
        throw new Error(
          "Bristol Group Tupelo response ended before reported total count",
        );
      }
      page += 1;
    } while (totalCount !== null && listings.length < totalCount);

    return listings;
  }

  private async fetchPage(
    page: number,
  ): Promise<{ listings: TupeloListing[]; totalCount: number }> {
    const url = new URL(LISTINGS_API_URL);
    url.searchParams.set("organizationId", ORGANIZATION_ID);
    url.searchParams.set("take", PAGE_SIZE.toString());
    url.searchParams.set("page", page.toString());

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Bristol Group Tupelo listings request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as TupeloListingsResponse;
    if (!Array.isArray(data.listings) || typeof data.totalCount !== "number") {
      throw new Error("Bristol Group Tupelo response had unexpected shape");
    }

    return {
      listings: data.listings as TupeloListing[],
      totalCount: data.totalCount,
    };
  }

  private makeListing(listing: TupeloListing, date: string): Listing {
    if (typeof listing.id !== "string" || !listing.id) {
      throw new Error("Bristol Group Tupelo listing is missing id");
    }

    const listingId = `${this.site}:${listing.id}`;
    const href = this.makeListingHref(listing.id);

    return {
      date,
      site: this.site,
      url: this.makeListingPageUrl(),
      title:
        typeof listing.headline === "string" ? listing.headline.trim() : null,
      href,
      listingId,
      id: hash(listingId),
    };
  }

  private makeListingHref(listingId: string): string {
    const url = new URL(this.path, this.baseUrl);
    url.searchParams.set("listingId", listingId);
    return url.toString();
  }

  private makeListingPageUrl(): string {
    return new URL(this.path, this.baseUrl).toString();
  }
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
