---
name: add-brokerage-site
description: Add or repair business brokerage listing site adapters in the scrapy-brokers-poc TypeScript scraper. Use when Codex needs to investigate a brokerage website, choose an API, paginated, or human navigation scraping strategy, implement or update src/adapters site handlers, register new sites, validate listing IDs and pagination coverage, or prove a new brokerage scraper works without breaking existing adapters.
---

# Add Brokerage Site

## Workflow

Use this skill for `scrapy-brokers-poc` adapter work. Read `AGENTS.md`, `src/adapters/base.ts`, `src/core/models/listing.ts`, and the closest existing adapter examples before editing. Load [references/repo-adapter-guide.md](references/repo-adapter-guide.md) when implementing or reviewing an adapter.

Follow this strategy order:

1. Prefer `SiteStrategy.Api` when network traffic, embedded JSON, GraphQL, REST endpoints, or static data sources expose listing data and pagination.
2. Use `SiteStrategy.Paginated` when URLs for all listing pages can be precomputed from query params, page counts, pagination links, sitemaps, or first-page metadata.
3. Use `SiteStrategy.Human` only when neither API nor precomputed pages are reliable and the site must be advanced by user-like navigation.

Document the rejected strategies briefly in the final response or PR notes, especially when falling back from API to browser scraping.

## Investigation

Inspect the target site before choosing an implementation:

- Check page source and network responses for stable JSON, GraphQL operations, REST endpoints, pagination metadata, and listing IDs.
- Confirm whether data can be fetched without browser-only session state. If headers/cookies are required, keep them minimal and explain why.
- Identify canonical listing URLs and any site-provided listing IDs.
- Verify how many pages or result batches exist and how the tail page is represented.
- Prefer selectors and response fields that reflect listing semantics over brittle visual structure.

## Implementation

Keep changes scoped to the new or repaired site:

- Create or update one adapter in `src/adapters/` with a lowercase filename and lowercase `site` identifier.
- Implement the matching interface from `src/adapters/base.ts`; do not create a new strategy abstraction unless the user explicitly asks for a broader platform change.
- Register new adapters in `src/adapters/index.ts`.
- Use TypeScript ESM style with `.js` relative imports, two-space indentation, double quotes, named exports where practical, and linear `async`/`await`.
- Define selectors, timeouts, page sizes, API paths, and regexes as constants.
- Avoid unrelated refactors, production recipient/config changes, credentials, and deployment-sensitive edits.

## Validation

Run validation proportionate to the change:

- Always run `npm run build`.
- Run a focused dry run for the new site with `npm run scrape:site -- <site>`. Use `npm run scrape:site:debug -- <site>` when verbose logs are needed.
- Audit listing IDs: check for duplicates within the run, unstable href-derived IDs, tracking params, fragments, relative URL inconsistencies, casing drift, and accidental overlap with existing data when available.
- Audit pagination completeness: prove listings from page 1 and later pages are captured, prove the tail page is not skipped, and prove human navigation stop conditions cannot loop forever.
- Use Docker validation when browser/runtime parity is uncertain.
- For new sites, do not run AWS/Fargate validation until `npm run build` and the focused local dry run are clean. After local validation passes, run AWS/Fargate dry-run validation whenever AWS credentials and Docker are available. Sites can behave differently in Fargate because of anti-bot controls, IP reputation, browser/runtime differences, network egress, DNS, and container resource limits.
- Use Docker validation when AWS/Fargate validation is blocked and browser/runtime parity is uncertain.

### AWS Ops CLI

Use the scripts-based AWS ops CLI for production-like validation and cleanup:

```bash
npm run aws:ops -- image build-push --tag dry-run-single-site-<site>-$(git rev-parse --short HEAD)
npm run aws:ops -- task run-dry-run --image-uri <imageUri> --site <site> --wait
npm run aws:ops -- task logs --task-id <taskId> --tail 80
npm run aws:ops -- image delete --tag <tag>
npm run aws:ops -- image cleanup-untagged --since-minutes 15
```

- Use the digest-based `imageUri` returned by `image build-push` for `task run-dry-run`.
- `task run-dry-run` always injects `DRY_RUN=true` and does not mutate the scheduled production stack.
- Verify CloudWatch logs show the expected single `site`, `MemoryStorage`, exit code `0`, and no scraping errors before considering AWS parity validated.
- Clean up the test image tag and recent untagged build artifacts after successful validation.
- Do not run `deploy scheduled` while validating a new adapter unless the user explicitly asks for a production deployment.

If validation cannot be run, state exactly what blocked it and what risk remains.
