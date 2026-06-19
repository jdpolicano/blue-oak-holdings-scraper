import { createHash } from "node:crypto";
import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function extractClassBlocks(
  html: string,
  tagName: string,
  className: string,
): string[] {
  const $ = loadFragment(html);
  return $(tagName)
    .filter((_, element) => $(element).hasClass(className))
    .toArray()
    .map((element) => $.html(element));
}

export function extractAttributeBlocks(
  html: string,
  tagName: string,
  attributeName: string,
): string[] {
  const $ = loadFragment(html);
  return $(`${tagName}[${attributeName}]`)
    .toArray()
    .map((element) => $.html(element));
}

export function extractHref(html: string): string | null {
  return extractAttribute(html, "href");
}

export function extractAttribute(
  html: string,
  attributeName: string,
): string | null {
  const $ = loadAttributeFragment(html);
  const firstElement = $.root().children().first();
  const value =
    firstElement.attr(attributeName) ??
    $(`[${attributeName}]`).first().attr(attributeName);

  return value ? decodeHtml(value) : null;
}

export interface LinkListing {
  title: string | null;
  hrefText: string;
  rawId: string;
}

export function parseLinkListings(
  html: string,
  hrefPattern: RegExp,
  baseUrl: string,
): LinkListing[] {
  const listings = new Map<string, LinkListing>();
  const $ = loadFragment(html);

  $("a[href]").each((_, element) => {
    const hrefText = $(element).attr("href");
    if (!hrefText || !hrefPattern.test(hrefText)) {
      hrefPattern.lastIndex = 0;
      return;
    }
    hrefPattern.lastIndex = 0;

    const href = new URL(hrefText, baseUrl);
    href.hash = "";
    const rawId = normalizePath(href);
    const title = extractLinkTitle($, element);
    const current = listings.get(rawId);

    if (!current || titleLength(title) > titleLength(current.title)) {
      listings.set(rawId, {
        title,
        hrefText,
        rawId,
      });
    }
  });

  return [...listings.values()];
}

export function normalizePath(url: URL): string {
  return url.pathname.replace(/\/+$/, "") || "/";
}

export function cleanText(text: string): string {
  return decodeHtml(text).replace(/\s+/g, " ").trim();
}

export function stripTags(html: string): string {
  const $ = loadFragment(html);
  const textParts: string[] = [];

  $.root()
    .contents()
    .each((_, node) => collectText($, node, textParts));

  return textParts.join(" ");
}

export function decodeHtml(text: string): string {
  return loadFragment(text).root().text();
}

function loadFragment(html: string): CheerioAPI {
  return load(html, null, false);
}

function loadAttributeFragment(html: string): CheerioAPI {
  const trimmed = html.trim();
  if (trimmed.startsWith("<")) {
    return loadFragment(trimmed);
  }

  return loadFragment(`<x ${trimmed}></x>`);
}

function collectText($: CheerioAPI, node: AnyNode, textParts: string[]): void {
  if (node.type === "text") {
    textParts.push(node.data);
    return;
  }

  $(node)
    .contents()
    .each((_, child) => collectText($, child, textParts));
}

function extractLinkTitle($: CheerioAPI, element: AnyNode): string | null {
  const text = cleanText(stripTags($.html(element)));
  const alt = $(element).find("[alt]").first().attr("alt");
  return text || (alt ? cleanText(alt) : null);
}

function titleLength(title: string | null): number {
  return title?.length ?? 0;
}
