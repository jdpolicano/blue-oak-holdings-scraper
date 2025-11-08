import { BaseApiObject, SiteStrategy } from "./base.js";
import { Listing } from "../core/models/listing.js";
import { Graffle } from "graffle";
import { Logger } from "pino";

const client = Graffle.create().transport({
  url: "https://api.batonmarket.com/query",
});

const sender = client.gql(`
  query searchBusinesses($filters: BusinessFilters, $order: SearchOrder!, $after: String, $before: String, $first: Int) {
    searchBusinesses(input: {filters: $filters, order: $order, after: $after, before: $before, first: $first}) {
      results {
        listing {
          id
          business_id
          name
          slug
        }
      }
      page_info {
        hasNextPage
        hasPreviousPage
        endCursor
        startCursor
      }
    }
  }`);

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor: string | null;
  startCursor: string | null;
}

interface ListingResult {
  listing: {
    id: string | null;
    business_id: string | null;
    name: string | null;
    slug: string | null;
  } | null;
}

interface SearchBusinessesResponse {
  searchBusinesses: {
    results: ListingResult[] | null;
    page_info: PageInfo | null;
  } | null;
}

export class BatonMarket implements BaseApiObject {
  siteStrategy: SiteStrategy.Api = SiteStrategy.Api;
  site = "batonmarket";
  baseUrl = "https://www.batonmarket.com/";
  path = "/market/businesses-for-sale";

  async fetchListings(logger: Logger): Promise<Listing[]> {
    let startCursor: string | null = null;
    let hasNextPage = true;
    const listings: Listing[] = [];
    while (hasNextPage) {
      const rawResponse: unknown = await sender.searchBusinesses({
        filters: {
          name: null,
        },
        first: 200,
        after: startCursor,
        order: {
          field: "ADJUSTED_CASH_FLOW",
          order: "DESC",
        },
      });
      const response = rawResponse as SearchBusinessesResponse;

      if (
        !response?.searchBusinesses?.results ||
        !response?.searchBusinesses?.page_info
      ) {
        this.logError(response, logger);
        break;
      }

      logger.info(
        `Fetched ${response.searchBusinesses.results.length} listings from BatonMarket API`,
      );

      const results = response.searchBusinesses.results;
      const newListings = results
        .map((result) => this.makeListing(result, logger))
        .filter((listing): listing is Listing => listing !== undefined);

      listings.push(...newListings);

      const pageInfo = response.searchBusinesses.page_info;
      hasNextPage = pageInfo.hasNextPage;
      startCursor = pageInfo.endCursor;
    }
    return listings;
  }

  private makeListing(
    result: ListingResult,
    logger: Logger,
  ): Listing | undefined {
    const { listing } = result;
    if (!listing || !listing.business_id || !listing.slug) {
      logger.warn(result, `Incomplete data for listing`);
      return;
    }
    const date = new Date().toISOString();
    return {
      title: listing.name,
      url: this.makeListingHref(listing.slug, listing.business_id),
      href: this.makeListingHref(listing.slug, listing.business_id),
      site: this.site,
      listingId: listing.business_id,
      id: listing.business_id,
      date,
    };
  }

  private makeListingHref(slug: string, businessId: string): string {
    const path = `${this.path}/${slug}/${businessId}`;
    return new URL(path, this.baseUrl).toString();
  }

  private logError(response: any, logger: Logger) {
    logger.error(response, `Response from BatonMarket API is empty`);
  }
}
