import { Listing } from "../models/listing.js";
import { ScrapingError } from "../models/error.js";
import hbs from "handlebars";
import fs from "fs/promises";

/**
 * The `BaseNotifier` class is responsible for generating notification payloads
 * in both HTML and plain-text formats based on a list of `Listing` objects.
 */
export class BaseNotifier {
  /**
   * Builds the notification payloads (HTML and plain-text) for the provided listings.
   *
   * @param listings - An array of `Listing` objects that represent the items to be included in the notification.
   * @returns A promise that resolves to an object containing:
   *   - `html`: A string with the rendered HTML content.
   *   - `text`: A string with the plain-text fallback content.
   *
   * If the `listings` array is empty, both `html` and `text` will be empty strings.
   */
  async buildPayloads(
    listings: Listing[],
  ): Promise<{ html: string; text: string }> {
    // If there are no listings, return empty payloads.
    if (listings.length === 0) return { html: "", text: "" };

    // Load the Handlebars template file from the filesystem.
    // The template file is expected to be located at "./templates/newListings.hbs".
    const source = await fs.readFile("./templates/newListings.hbs", "utf-8");

    // Compile the Handlebars template into a reusable function.
    const template = hbs.compile(source);

    // Render the HTML content using the template.
    // The template is provided with the `listings` data and a `generatedAt` timestamp.
    const html = template({
      listings: listings,
      generatedAt: new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
      }),
    });

    // Generate a plain-text fallback by mapping each listing to a simple string format.
    // Each listing is represented as "Title: URL", with "Untitled" used as a fallback for missing titles.
    const text = listings
      .map((l: Listing) => `${l.title ?? "Untitled"}: ${l.href}`)
      .join("\n");

    // Return the generated HTML and plain-text payloads.
    return { html, text };
  }

  /**
   * Builds the notification payloads (HTML and plain-text) for scraping errors.
   *
   * @param errors - An array of `ScrapingError` objects that represent the errors to be included in the notification.
   * @returns A promise that resolves to an object containing:
   *   - `html`: A string with the rendered HTML content.
   *   - `text`: A string with the plain-text fallback content.
   *
   * If the `errors` array is empty, both `html` and `text` will be empty strings.
   */
  async buildErrorPayloads(
    errors: ScrapingError[],
  ): Promise<{ html: string; text: string }> {
    // If there are no errors, return empty payloads.
    if (errors.length === 0) return { html: "", text: "" };

    // Load the Handlebars template file from the filesystem.
    // The template file is expected to be located at "./templates/scrapingErrors.hbs".
    const source = await fs.readFile("./templates/scrapingErrors.hbs", "utf-8");

    // Compile the Handlebars template into a reusable function.
    const template = hbs.compile(source);

    // Render the HTML content using the template.
    // The template is provided with the `errors` data and a `generatedAt` timestamp.
    const html = template({
      errors: errors,
      generatedAt: new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
      }),
      totalErrors: errors.length,
      affectedSites: [...new Set(errors.map(e => e.site))].length,
    });

    // Generate a plain-text fallback by mapping each error to a simple string format.
    const text = errors
      .map((e: ScrapingError) => `[${e.errorType}] ${e.site}: ${e.description}`)
      .join("\n");

    // Return the generated HTML and plain-text payloads.
    return { html, text };
  }
}
