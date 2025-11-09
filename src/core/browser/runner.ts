import { Logger } from "pino";
import { Browser, Page, LaunchOptions } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { Storage } from "../storage/index.js";

import {
  BasePageObjectPaginated,
  BasePageObjectHuman,
  SiteStrategy,
} from "../../adapters/base.js";

import { PageRunner } from "../browser/page.js";

/**
 * Public options to configure a scrape session.
 */
export interface BrowserRunnerOptions {
  /** Logger instance for structured logging. */
  logger: Logger;
  /** Site handlers to scrape. */
  sites: Array<BasePageObjectHuman | BasePageObjectPaginated>;
  /** Storage sink to receive scraped listings. */
  storage: Storage;
  /** Max number of concurrent Playwright pages. */
  concurrency: number;
  /** Playwright launch options (headless, proxy, etc.). */
  browserOptions?: LaunchOptions;
}

/** Internal, fully-resolved options passed to the handle. */
interface BrowserRunnerOptionsInternal {
  logger: Logger;
  sites: (BasePageObjectHuman | BasePageObjectPaginated)[];
  storage: Storage;
  concurrency: number;
  browser: Browser;
  pages: Page[];
}

interface ListingTaskPaginated {
  strategy: SiteStrategy.Paginated;
  siteHandler: BasePageObjectPaginated;
  url: string;
}

interface ListingTaskHuman {
  strategy: SiteStrategy.Human;
  siteHandler: BasePageObjectHuman;
  url: string;
}

type ListingTask = ListingTaskPaginated | ListingTaskHuman;

/**
 * BrowserRunner manages the browser lifecycle and a small worker pool based on `Promise.race`.
 * Each worker corresponds to a Playwright Page. As soon as a page completes a task,
 * it immediately pulls and runs the next one.
 */
export class BrowserRunner {
  private readonly logger: Logger;
  private readonly sites: Array<BasePageObjectHuman | BasePageObjectPaginated>;
  private readonly storage: Storage;
  private readonly browser: Browser;
  private readonly concurrency: number;

  /** Preallocated Playwright pages serving as workers. */
  private readonly pages: Page[];

  /** FIFO queue of pending tasks. */
  private readonly taskQueue: ListingTask[] = [];

  /**
   * Array indexed by page index. Each slot holds the in-flight promise for that page,
   * or `null` when the page is idle.
   */
  private inFlight: Promise<number>[] = [];

  private constructor({
    logger,
    sites,
    browser,
    pages,
    storage,
    concurrency,
  }: BrowserRunnerOptionsInternal) {
    this.logger = logger.child({ component: BrowserRunner.name });
    this.sites = sites;
    this.browser = browser;
    this.pages = pages;
    this.storage = storage;
    this.concurrency = concurrency;
  }

  /**
   * Create a BrowserRunner with a launched browser and preallocated pages.
   * @remarks Uses `puppeteer-extra-plugin-stealth` via `playwright-extra`.
   */
  static async create(opts: BrowserRunnerOptions) {
    const { logger, sites, storage, browserOptions, concurrency } = opts;

    chromium.use(stealth());
    const browser = await chromium.launch(browserOptions);

    // Pre-create worker pages
    const pages: Page[] = [];

    return new BrowserRunner({
      logger,
      sites,
      storage,
      concurrency: Math.max(1, concurrency),
      browser,
      pages,
    });
  }

  /**
   * Run the full scrape:
   * 1) Build the task queue
   * 2) Seed one task per page
   * 3) Loop with Promise.race to keep pages busy
   * 4) Drain remaining in-flight tasks
   */
  async run(): Promise<void> {
    try {
      await this.buildTaskQueue();
      await this.seedInitialWork();
      this.logger.info(
        {
          sites: this.sites.length,
          tasks: this.taskQueue.length,
          pages: this.pages.length,
        },
        "Starting scrape",
      );
      await this.processUntilQueueEmpty();
      await this.drainInFlight();
    } finally {
      await this.teardown();
    }
  }

  // ──────────────────────────────
  // Queue construction
  // ──────────────────────────────

  /**
   * Build the task queue by asking each site for its target URLs.
   * Uses a temporary page for `getUrls` to avoid contaminating worker pages.
   */
  private async buildTaskQueue(): Promise<void> {
    for (const site of this.sites) {
      if (site.siteStrategy === SiteStrategy.Human) {
        const url = new URL(site.path, site.baseUrl).toString();
        this.enqueueTask({
          strategy: SiteStrategy.Human,
          siteHandler: site,
          url,
        });
        continue;
      }

      // Paginated: fetch URLs with a disposable page so we don't leave worker state behind.
      const tmp = await this.browser.newPage();
      try {
        const urls = await site.getUrls(tmp);
        for (const url of urls) {
          this.enqueueTask({
            strategy: SiteStrategy.Paginated,
            siteHandler: site,
            url,
          });
        }
        this.logger.info(
          { site: site.site, totalUrls: urls.length },
          "Enqueued paginated tasks",
        );
      } catch (err) {
        this.logger.error(
          { site: site.site, err },
          "Error building paginated tasks",
        );
      } finally {
        await tmp.close();
      }
    }
  }

  /** Push a task onto the FIFO queue. */
  private enqueueTask(task: ListingTask): void {
    if (task.strategy === SiteStrategy.Human) {
      this.logger.info(
        { site: task.siteHandler.site, url: task.url },
        "Enqueued human task",
      );
    } else {
      this.logger.debug(
        { site: task.siteHandler.site, url: task.url },
        "Enqueued paginated task",
      );
    }
    this.taskQueue.push(task);
  }

  // ──────────────────────────────
  // Worker pool (Promise.race)
  // ──────────────────────────────

  /**
   * Seed the pool with up to `concurrency` initial tasks—one per page index.
   * Assumes `buildTaskQueue` has already populated `taskQueue`.
   */
  private async seedInitialWork() {
    for (let i = 0; i < Math.max(1, this.concurrency); i++) {
      this.pages.push(await this.browser.newPage());
    }

    this.inFlight = Array(this.pages.length).fill(null);

    const initial = Math.min(this.pages.length, this.taskQueue.length);
    for (let pageIdx = 0; pageIdx < initial; pageIdx++) {
      const next = this.taskQueue.shift();
      if (!next) break;
      this.inFlight[pageIdx] = this.runTaskOnPage(pageIdx, next);
    }
  }

  /**
   * Keep assigning tasks while the queue has items:
   * wait for whichever page finishes first, then reuse that page for the next task.
   */
  private async processUntilQueueEmpty(): Promise<void> {
    while (this.taskQueue.length > 0) {
      const freedPageIdx = await Promise.race(this.inFlight);
      const next = this.taskQueue.shift()!;
      this.inFlight[freedPageIdx] = this.runTaskOnPage(freedPageIdx, next);
    }
  }

  /** Wait for all remaining in-flight tasks to complete. */
  private async drainInFlight(): Promise<void> {
    await Promise.all(this.inFlight);
  }

  /**
   * Execute a task on a specific page and resolve with the same page index
   * so the caller can reassign work to that slot.
   */
  private async runTaskOnPage(
    pageIdx: number,
    task: ListingTask,
  ): Promise<number> {
    const page = this.pages[pageIdx];

    try {
      const runner = new PageRunner(
        this.logger.child({
          component: PageRunner.name,
          site: task.siteHandler.site,
          url: task.url,
          pageIdx,
        }),
      );

      const listings =
        task.strategy === SiteStrategy.Paginated
          ? await runner.getListingsPaginated(page, task.url, task.siteHandler)
          : await runner.getListingsHuman(page, task.url, task.siteHandler);

      if (listings.length) {
        await this.storage.appendListing(...listings);
        this.logger.info(
          {
            site: task.siteHandler.site,
            url: task.url,
            total: listings.length,
            pageIdx,
          },
          "Listings found",
        );
      } else {
        this.logger.warn(
          { site: task.siteHandler.site, url: task.url, pageIdx },
          "No listings found",
        );
      }
    } catch (err) {
      this.logger.error(
        { site: task.siteHandler.site, url: task.url, pageIdx, err },
        "Error scraping",
      );
    }

    return pageIdx;
  }

  // ──────────────────────────────
  // Teardown
  // ──────────────────────────────

  /** Close all pages and the browser. Safe to call multiple times. */
  private async teardown(): Promise<void> {
    for (const p of this.pages) {
      try {
        await p.close();
      } catch {
        /* ignore */
      }
    }
    try {
      await this.browser.close();
    } catch {
      /* ignore */
    }
  }
}
