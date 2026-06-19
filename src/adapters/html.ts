import { createHash } from "node:crypto";

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
  return extractElementBlocks(html, tagName, (tag) => hasClass(tag, className));
}

export function extractAttributeBlocks(
  html: string,
  tagName: string,
  attributeName: string,
): string[] {
  return extractElementBlocks(
    html,
    tagName,
    (tag) => extractAttribute(tag, attributeName) !== null,
  );
}

export function extractElementBlocks(
  html: string,
  tagName: string,
  predicate: (openingTag: string) => boolean,
): string[] {
  const blocks: string[] = [];
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  let match: RegExpExecArray | null;
  let start = -1;
  let depth = 0;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[0];
    const isClosingTag = /^<\//.test(tag);

    if (start === -1) {
      if (!isClosingTag && predicate(tag)) {
        start = match.index;
        depth = 1;
      }
      continue;
    }

    depth += isClosingTag ? -1 : 1;
    if (depth === 0) {
      blocks.push(html.slice(start, tagPattern.lastIndex));
      start = -1;
    }
  }

  return blocks;
}

export function hasClass(tag: string, className: string): boolean {
  const classValue = extractAttribute(tag, "class");
  if (!classValue) {
    return false;
  }

  return classValue.split(/\s+/).includes(className);
}

export function extractAttribute(html: string, attributeName: string): string | null {
  const pattern = new RegExp(
    `\\b${escapeRegExp(attributeName)}=(["'])(?<value>.*?)\\1`,
    "i",
  );
  const match = html.match(pattern);
  return match?.groups?.value ? decodeHtml(match.groups.value) : null;
}

export function extractHref(html: string): string | null {
  return extractAttribute(html, "href");
}

export function cleanText(text: string): string {
  return decodeHtml(text).replace(/\s+/g, " ").trim();
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

export function decodeHtml(text: string): string {
  return text
    .replace(/&#(?<code>\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x(?<code>[0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&hellip;/g, "...")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
