# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript ESM scraper for business brokerage listings. Source code lives in `src/`; `src/index.ts` is the entry point and `src/setup.ts` wires configuration, storage, scraping, and notification components. Site-specific scrapers live in `src/adapters/` and implement the interfaces in `src/adapters/base.ts`. Shared browser, config, storage, notification, scraping, and model code lives under `src/core/`. Runtime configuration is in `config/`, email templates are in `templates/`, and AWS/Fargate infrastructure is in `infra/`. Compiled output goes to `dist/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run install-browser`: install Playwright Chromium and system dependencies.
- `npm run build`: run `tsc` and emit JavaScript to `dist/`.
- `npm run start`: run the built scraper with Node.
- `npm run dev`: build and run locally with `DRY_RUN=true`, formatting logs through `pino-pretty`.
- `npm run debug`: run `dev` with `LOG_LEVEL=debug`.
- `npm run docker-dev-local`: build the Docker image and run it with `config/local.config.json`.
- `npm run cfn-lint`: lint CloudFormation templates in `infra/`; this is also the Husky pre-commit hook.

## Coding Style & Naming Conventions

Use strict TypeScript with `module` and `moduleResolution` set to `nodenext`. Keep source files in ESM style and include `.js` extensions in relative imports, as existing files do. Use two-space indentation, double quotes, and named exports where practical. Adapter class names should be PascalCase, while adapter filenames and `site` identifiers should stay lowercase, for example `src/adapters/bizbuysell.ts` with `site = "bizbuysell"`.
Prefer linear `async`/`await` control flow over `.then()` chains. Name scraper-specific selectors, timeouts, page sizes, and regex patterns as constants instead of embedding magic values inside adapter logic.

## Testing Guidelines

There are currently no committed automated tests, and `npm test` is a placeholder that fails. Jest is installed, so add future tests as focused TypeScript unit tests near the relevant module or under `test/`, using names such as `adapter-name.test.ts`. At minimum, run `npm run build` after code changes and use `DRY_RUN=true` workflows for scraper validation.

## Commit & Pull Request Guidelines

Recent history uses concise subjects, often Conventional Commit prefixes such as `feat:`, `fix:`, `chore:`, and `nit:`. Keep commits scoped to one change and mention the affected adapter or subsystem when useful. Pull requests should include a short description, any config or AWS changes, validation commands run, and screenshots or rendered email samples when templates change.

## Security & Configuration Tips

Do not commit credentials, AWS secrets, or production-only recipient details. Prefer local overrides through environment variables such as `CONFIG_PATH`, `DRY_RUN`, and `LOG_LEVEL`. Treat `config/scrape.config.json` and S3/SES settings as deployment-sensitive.
