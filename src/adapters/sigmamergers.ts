import { StaticListingsAdapter } from "./static-listings.js";

const LISTINGS_URL = "https://sigmamergers.com/businesses-for-sale/";

export class SigmaMergers extends StaticListingsAdapter {
  constructor() {
    super({
      site: "sigmamergers",
      baseUrl: "https://sigmamergers.com/",
      path: "/businesses-for-sale/",
      logName: "Sigma Mergers",
      sources: [
        {
          url: LISTINGS_URL,
          hrefPattern: /\/listing\//i,
        },
      ],
    });
  }
}
