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
  browserOptions: z.object({
    headless: z.boolean().default(true),
    args: z.array(z.string()).default([]),
  }),
});

const programConfig = z.object({
  dryRun: z.boolean().default(envConfig.DRY_RUN),
  notifications: z.object({
    source: sourceEnum,
    config: notificationsConfig,
  }),
  dataSources: z.object({
    source: sourceEnum,
    config: dataSourcesConfig,
  }),
  scraperOptions: scraperOptionsConfig.default({
    sites: [],
    concurrency: 3,
    browserOptions: {
      headless: true,
      args: [],
    },
  }),
});

type ProgramConfigFile = z.infer<typeof programConfig>;

type ProgramConfig = ProgramConfigFile & {
  scraperOptions: z.infer<typeof scraperOptionsConfig>;
};

export class Config {
  config: ProgramConfig;

  private constructor(config: ProgramConfig) {
    this.config = config;
  }

  get<K extends keyof ProgramConfig>(key: K): ProgramConfig[K] {
    return this.config[key];
  }

  static async getConfig(): Promise<Config> {
    const { PROGRAM_CONFIG_PATH } = envConfig;
    const configRaw = await fs.readFile(PROGRAM_CONFIG_PATH, {
      encoding: "utf-8",
    });
    const configJson = JSON.parse(configRaw);
    const validatedConfig = programConfig.parse(configJson);
    if (isDocker()) {
      validatedConfig.scraperOptions.browserOptions.args = [
        "--no-sandbox", // Required: sandboxing doesn't work in Fargate
        "--disable-setuid-sandbox", // Disable setuid helper; redundant but safe
        "--disable-dev-shm-usage", // Use /tmp instead of /dev/shm to avoid small SHM crashes
        "--disable-gpu", // No GPU on Fargate; prevents GL errors
      ];
    }
    return new Config(validatedConfig);
  }
}
