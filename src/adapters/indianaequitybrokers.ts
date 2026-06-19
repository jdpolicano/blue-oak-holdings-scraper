import { StaticListingsAdapter } from "./static-listings.js";

const LISTINGS_URL = "https://indianaequitybrokers.com/businesses-for-sale/";

export class IndianaEquityBrokers extends StaticListingsAdapter {
  constructor() {
    super({
      site: "indianaequitybrokers",
      baseUrl: "https://indianaequitybrokers.com/",
      path: "/businesses-for-sale/",
      logName: "Indiana Equity Brokers",
      sources: [
        {
          url: LISTINGS_URL,
          hrefPattern: /\/listing\//i,
        },
      ],
    });
  }
}
