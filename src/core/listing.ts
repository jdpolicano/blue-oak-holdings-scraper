export interface Listing {
  // the title of the listing
  title?: string | null;
  // where the listing points to
  href: string;
  // the site we found the listing on if any
  site?: string | null;
  // the url we found the page on.
  url?: string | null;
  // the date we found the listing on (iso date string)
  date: string;
  // the unique id of the listing
  id: string;
}
