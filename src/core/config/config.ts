import { z } from "zod";
import { envConfig } from "./env.js";
import fs from "node:fs/promises";
import isDocker from "is-docker";

const sourceEnum = z.enum(["local"]);

const notificationsConfig = z.object({
  admin: z.string(),
  sender: z.string(),
  to: z.array(z.string()),
});

const dataSourcesConfigS3 = z.object({
  type: z.literal("s3"),
  bucket: z.string(),
  dataKey: z.string(),
});

const dataSourcesConfig = z.discriminatedUnion("type", [dataSourcesConfigS3]);

const scraperOptionsConfig = z.object({
  sites: z.array(z.string()).default([]),
  concurrency: z.number().default(3),
  browserOptions: z
    .object({
      headless: z.boolean().default(true),
      args: z
        .array(z.string())
        .default(
          isDocker()
            ? [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
              ]
            : [],
        ),
    })
    .default({ headless: true, args: [] }),
});

const programConfig = z.object({
  dryRun: z.boolean().default(envConfig.DRY_RUN),
  source: sourceEnum.default("local"),
  notifications: notificationsConfig,
  database: dataSourcesConfig,
  scraper: scraperOptionsConfig.default({
    sites: [],
    concurrency: 3,
    browserOptions: {
      headless: true,
      args: [],
    },
  }),
});

export type ProgramConfig = z.infer<typeof programConfig>;

function parseScraperSitesOverride(sites: string): string[] | undefined {
  const parsedSites = sites
    .split(",")
    .map((site) => site.trim())
    .filter(Boolean);
  return parsedSites.length ? parsedSites : undefined;
}

export class Config {
  config: ProgramConfig;

  private constructor(config: ProgramConfig) {
    this.config = config;
  }

  get<K extends keyof ProgramConfig>(key: K): ProgramConfig[K] {
    return this.config[key];
  }

  static async getConfig(): Promise<Config> {
    const { CONFIG_PATH, SCRAPER_SITES } = envConfig;
    const configRaw = await fs.readFile(CONFIG_PATH, {
      encoding: "utf-8",
    });
    const configJson = JSON.parse(configRaw);
    const validatedConfig = programConfig.parse(configJson);
    const scraperSitesOverride = parseScraperSitesOverride(SCRAPER_SITES);
    if (scraperSitesOverride) {
      validatedConfig.scraper.sites = scraperSitesOverride;
    }
    return new Config(validatedConfig);
  }
}
