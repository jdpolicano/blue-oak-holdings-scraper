export interface Listing {
  // the title of the listing
  title: string | null;
  // where the listing points to
  href: string;
  // the site we found the listing on if any
  site: string | null;
  // the url we found the page on.
  url: string | null;
  // the listing id if the site provides one
  listingId: string | null;
  // the date we found the listing on (iso date string)
  date: string;
  // the unique id of the listing for internal deduplication
  id: string;
}

export const enum ListingId {
  // native means we generated the id ourselves using the href
  // of a given listing as a uid.
  Native,
  // site generated means the site provided us with a unique id via some info we
  // were able to scrape off of the page /api.
  SiteGenerated,
}
