export interface Listing {
  // the title of the listing
  title: string;
  // where we found the listing
  href: string;
  // the site we found the listing on
  site: string;
  // the date we found the listing on (iso date string)
  date: string;
}
