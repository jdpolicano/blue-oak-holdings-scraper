import { Listing } from "../models/listing.js";
import { ScrapingError } from "../models/error.js";
import hbs from "handlebars";
import fs from "fs/promises";

/**
 * Renders a Handlebars template with the given data.
 *
 * @param templatePath - Path to the Handlebars template file
 * @param data - Data to pass to the template
 * @returns The rendered HTML string
 */
async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const source = await fs.readFile(templatePath, "utf-8");
  const template = hbs.compile(source);
  return template(data);
}

/**
 * Builds notification payloads (HTML and plain-text) for listings.
 *
 * @param listings - Array of listings to include in the notification
 * @returns Object containing HTML and plain-text versions of the notification
 */
export async function buildListingPayloads(
  listings: Listing[],
): Promise<{ html: string; text: string }> {
  if (listings.length === 0) return { html: "", text: "" };

  const html = await renderTemplate("./templates/newListings.hbs", {
    listings,
    generatedAt: new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    }),
  });

  const text = listings
    .map((l: Listing) => `${l.title ?? "Untitled"}: ${l.href}`)
    .join("\n");

  return { html, text };
}

/**
 * Builds notification payloads (HTML and plain-text) for scraping errors.
 *
 * @param errors - Array of scraping errors to include in the notification
 * @returns Object containing HTML and plain-text versions of the notification
 */
export async function buildErrorPayloads(
  errors: ScrapingError[],
): Promise<{ html: string; text: string }> {
  if (errors.length === 0) return { html: "", text: "" };

  const html = await renderTemplate("./templates/scrapingErrors.hbs", {
    errors,
    generatedAt: new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    }),
    totalErrors: errors.length,
    affectedSites: [...new Set(errors.map((e) => e.site))].length,
  });

  const text = errors
    .map((e: ScrapingError) => `[${e.errorType}] ${e.site}: ${e.description}`)
    .join("\n");

  return { html, text };
}
