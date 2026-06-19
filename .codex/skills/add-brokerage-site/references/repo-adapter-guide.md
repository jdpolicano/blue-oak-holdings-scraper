# Repo Adapter Guide

## Files To Inspect

- `AGENTS.md`: repository coding, validation, and security rules.
- `src/adapters/base.ts`: `BaseApiObject`, `BasePageObjectPaginated`, `BasePageObjectHuman`, and `SiteStrategy`.
- `src/adapters/index.ts`: registry wiring for new site classes.
- `src/core/models/listing.ts`: required listing shape.
- `src/core/scrape.ts` and `src/core/browser/page.ts`: runtime behavior for API and browser strategies.
- Existing adapters matching the chosen strategy, such as `tworld.ts` for API-assisted pagination and `bizbuysell.ts` for paginated browser scraping.

## Strategy Checklist

Choose `Api` when a stable endpoint can return all listings with enough fields to build `Listing[]`: title, href, site, source URL, listing ID if available, date, and internal ID. Prefer explicit pagination metadata or cursor termination over guessing.

Choose `Paginated` when the site exposes deterministic page URLs. `getUrls` must return every URL that needs scraping. Confirm whether the current runner expects page 1 to be included for the selected pattern by checking nearby adapters and `BrowserRunner`.

Choose `Human` only when page URLs cannot be precomputed. Implement a bounded `shouldStop` condition, make `nextPage` wait for real page/listing changes, and set `isTailPageScrapable` according to whether the final page should be scraped after stop detection.

## Listing ID Rules

Prefer site-provided immutable listing IDs. If using URLs:

- Resolve relative hrefs against `baseUrl`.
- Remove fragments and tracking parameters such as `utm_*`, `fbclid`, `gclid`, and session tokens.
- Normalize host casing and obvious trailing slash differences.
- Do not include listing page pagination parameters in the listing ID.
- Keep IDs stable across repeated runs for the same listing.

After a dry run, inspect output or logs for duplicate IDs and suspicious duplicate href/title pairs. If existing historical data is available, compare the new site's IDs against it to catch accidental cross-site collisions.

## Pagination Coverage

For API and paginated implementations, verify:

- The first page and at least one later page are represented when the site has multiple pages.
- The last page is included and not skipped by an off-by-one range.
- Empty result pages end the scrape only when the site documents or demonstrates that behavior.
- Result counts roughly match the site's visible totals or API pagination metadata.

For human navigation, verify:

- `shouldStop` becomes true on the tail page.
- `nextPage` cannot keep clicking a disabled/current-page control.
- The implementation waits for either URL, response, or listing content changes before scraping the next page.

## Validation Commands

Minimum:

```bash
npm run build
```

Focused local validation:

```bash
DRY_RUN=true CONFIG_PATH=./config/local.config.json LOG_LEVEL=debug npm run build
DRY_RUN=true CONFIG_PATH=./config/local.config.json LOG_LEVEL=debug npm run start
```

Use a temporary config for a single new site when needed. Do not commit production recipient changes or credentials.

Docker parity when local browser behavior is uncertain:

```bash
npm run docker-dev-local
```

AWS/Fargate dry run only when requested or infrastructure compatibility is in scope:

```bash
npm run aws:run-dry-run
```
