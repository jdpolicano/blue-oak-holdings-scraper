import { StaticListingsAdapter } from "../core/adapters/static-listings.js";

const LISTINGS_URL = "https://sunacquisitions.com/featured-business-listings/";

export class SunAcquisitions extends StaticListingsAdapter {
  constructor() {
    super({
      site: "sunacquisitions",
      baseUrl: "https://sunacquisitions.com/",
      path: "/featured-business-listings/",
      logName: "Sun Acquisitions",
      sources: [
        {
          url: LISTINGS_URL,
          hrefPattern: /\/business_listing\//i,
        },
      ],
    });
  }
}
