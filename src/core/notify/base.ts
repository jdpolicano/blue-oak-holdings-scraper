import { Listing } from "../models/listing.js";
import hbs from "handlebars";
import fs from "fs/promises";

export class BaseNotifier {
  async buildPayloads(
    listings: Listing[],
  ): Promise<{ html: string; text: string }> {
    if (listings.length === 0) return { html: "", text: "" };

    // load + compile handlebars template
    const source = await fs.readFile("./templates/newListings.hbs", "utf-8");
    const template = hbs.compile(source);

    // render the HTML
    const html = template({
      listings: listings,
      generatedAt: new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
      }),
    });

    // fallback plain-text
    const text = listings
      .map((l: Listing) => `${l.title ?? "Untitled"}: ${l.href}`)
      .join("\n");

    // print notification plan
    return { html, text };
  }
}
