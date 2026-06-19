import { StaticListingsAdapter } from "./static-listings.js";

const LISTINGS_URL = "https://www.kcapex.com/business-listings/?status=active";

export class KCApex extends StaticListingsAdapter {
  constructor() {
    super({
      site: "kcapex",
      baseUrl: "https://www.kcapex.com/",
      path: "/business-listings/?status=active",
      logName: "KC Apex",
      sources: [
        {
          url: LISTINGS_URL,
          hrefPattern: /\/business-listing\//i,
        },
      ],
    });
  }
}
