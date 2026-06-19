import { parseArgs } from "node:util";

export const DEFAULT_REGION = "us-east-1";
export const DEFAULT_STACK_NAME = "blue-oak-holdings-scraper";
export const DEFAULT_SCHEDULED_RULE_LOGICAL_ID = "ScheduledScrape";
export const DEFAULT_DOCKER_PLATFORM = "linux/amd64";
export const DEFAULT_TEMPLATE_PATH = "infra/fargate-task-chromium.yaml";
export const PROTECTED_IMAGE_TAGS = new Set([
  "latest",
  "prod",
  "production",
  "main",
  "stable",
]);

export interface AwsOpsConfig {
  region: string;
  stackName: string;
  scheduledRuleLogicalId: string;
  dockerPlatform: string;
  templatePath: string;
}

export interface ParsedCommand {
  commandPath: string[];
  options: Record<string, string | boolean | string[] | undefined>;
}

export function getConfig(): AwsOpsConfig {
  return {
    region: process.env.REGION ?? process.env.AWS_REGION ?? DEFAULT_REGION,
    stackName: process.env.STACK_NAME ?? DEFAULT_STACK_NAME,
    scheduledRuleLogicalId:
      process.env.SCHEDULED_RULE_LOGICAL_ID ??
      DEFAULT_SCHEDULED_RULE_LOGICAL_ID,
    dockerPlatform: process.env.DOCKER_PLATFORM ?? DEFAULT_DOCKER_PLATFORM,
    templatePath: process.env.CLOUDFORMATION_TEMPLATE ?? DEFAULT_TEMPLATE_PATH,
  };
}

export function parseCommand(argv: string[]): ParsedCommand {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "confirm-production": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      "image-uri": { type: "string" },
      "log-group": { type: "string" },
      "since-minutes": { type: "string" },
      site: { type: "string", multiple: true },
      sites: { type: "string" },
      tag: { type: "string" },
      "task-arn": { type: "string" },
      "task-id": { type: "string" },
      tail: { type: "string" },
      wait: { type: "boolean", default: false },
    },
  });

  return {
    commandPath: parsed.positionals,
    options: parsed.values,
  };
}

export function getStringOption(
  options: ParsedCommand["options"],
  name: string,
): string | undefined {
  const value = options[name];
  if (typeof value === "string") return value;
  return undefined;
}

export function getStringArrayOption(
  options: ParsedCommand["options"],
  name: string,
): string[] {
  const value = options[name];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

export function getBooleanOption(
  options: ParsedCommand["options"],
  name: string,
): boolean {
  return options[name] === true;
}

export function requireStringOption(
  options: ParsedCommand["options"],
  name: string,
): string {
  const value = getStringOption(options, name);
  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

export function getIntegerOption(
  options: ParsedCommand["options"],
  name: string,
  defaultValue: number,
): number {
  const value = getStringOption(options, name);
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

export function requireValue<T>(
  value: T | null | undefined,
  message: string,
): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(message);
  }
  return value;
}

export function parseSitesOption(options: ParsedCommand["options"]): string {
  const siteValues = getStringArrayOption(options, "site");
  const sitesValue = getStringOption(options, "sites");
  return [...siteValues, ...(sitesValue ? sitesValue.split(",") : [])]
    .map((site) => site.trim())
    .filter(Boolean)
    .join(",");
}
