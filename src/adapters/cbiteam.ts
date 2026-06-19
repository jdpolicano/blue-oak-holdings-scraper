import { StaticListingsAdapter } from "./static-listings.js";

const LISTINGS_URL = "https://cbiteam.com/businesses-for-sale/";

export class CBITeam extends StaticListingsAdapter {
  constructor() {
    super({
      site: "cbiteam",
      baseUrl: "https://cbiteam.com/",
      path: "/businesses-for-sale/",
      logName: "CBI Team",
      sources: [
        {
          url: LISTINGS_URL,
          hrefPattern: /\/deal-listing\//i,
        },
        {
          url: `${LISTINGS_URL}?dl_page=2`,
          hrefPattern: /\/deal-listing\//i,
        },
        {
          url: `${LISTINGS_URL}?dl_page=3`,
          hrefPattern: /\/deal-listing\//i,
        },
        {
          url: `${LISTINGS_URL}?dl_page=4`,
          hrefPattern: /\/deal-listing\//i,
        },
      ],
    });
  }
}
