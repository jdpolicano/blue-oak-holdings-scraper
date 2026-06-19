import { ECRClient } from "@aws-sdk/client-ecr";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { createAwsClients, getCallerAccountId, resolveScheduledTarget } from "./aws/aws.js";
import { deployScheduledStack } from "./aws/cloudformation.js";
import {
  getBooleanOption,
  getConfig,
  getIntegerOption,
  getStringOption,
  parseCommand,
  parseSitesOption,
  PROTECTED_IMAGE_TAGS,
  requireStringOption,
} from "./aws/config.js";
import {
  buildAndPushImage,
  cleanupRecentUntaggedImages,
  deleteImageByTag,
  describeImageByTag,
  parseEcrImageUri,
  resolveEcrRepository,
} from "./aws/ecr.js";
import { runDryRunTask } from "./aws/ecs.js";
import { getTaskLogs } from "./aws/logs.js";
import { getGitSourceMetadata, logProgress } from "./aws/process.js";

const HELP = `Usage:
  npm run aws:ops -- image build-push [--tag <tag>]
  npm run aws:ops -- image delete --tag <tag> [--force]
  npm run aws:ops -- image cleanup-untagged --since-minutes <minutes>
  npm run aws:ops -- deploy scheduled --image-uri <uri> --confirm-production
  npm run aws:ops -- task run-dry-run [--image-uri <uri>] [--site <site>] [--sites <csv>] [--wait]
  npm run aws:ops -- task logs (--task-arn <arn> | --task-id <id>) [--tail <n>]

Defaults:
  REGION/AWS_REGION: us-east-1
  STACK_NAME: blue-oak-holdings-scraper
  SCHEDULED_RULE_LOGICAL_ID: ScheduledScrape
  DOCKER_PLATFORM: linux/amd64
`;

async function main(): Promise<void> {
  const parsed = parseCommand(process.argv.slice(2));
  if (getBooleanOption(parsed.options, "help")) {
    process.stdout.write(HELP);
    return;
  }

  const config = getConfig();
  const clients = createAwsClients(config);
  const [domain, action] = parsed.commandPath;

  if (domain === "image" && action === "build-push") {
    const tag = getStringOption(parsed.options, "tag") ?? "latest";
    const scheduledTarget = await resolveScheduledTarget(clients, config);
    const repository = await resolveEcrRepository(
      scheduledTarget.containerImage,
    );
    const ecr = new ECRClient({ region: config.region });
    const build = await buildAndPushImage({
      client: ecr,
      config,
      repository,
      tag,
    });

    writeJson({
      command: "image build-push",
      region: config.region,
      accountId: await getCallerAccountId(clients),
      ...build,
      git: await getGitSourceMetadata(),
    });
    return;
  }

  if (domain === "image" && action === "delete") {
    const tag = requireStringOption(parsed.options, "tag");
    const force = getBooleanOption(parsed.options, "force");
    if (!force && PROTECTED_IMAGE_TAGS.has(tag)) {
      throw new Error(
        `Refusing to delete protected image tag ${tag}. Use --force to override.`,
      );
    }

    const scheduledTarget = await resolveScheduledTarget(clients, config);
    const repository = await resolveEcrRepository(
      scheduledTarget.containerImage,
    );
    const ecr = new ECRClient({ region: config.region });
    if (!force) {
      await assertImageIsNotScheduled({
        ecr,
        repositoryName: repository.repositoryName,
        tag,
        scheduledImageUri: scheduledTarget.containerImage,
      });
    }

    const deleted = await deleteImageByTag({ client: ecr, repository, tag });
    writeJson({
      command: "image delete",
      region: config.region,
      ...deleted,
    });
    return;
  }

  if (domain === "image" && action === "cleanup-untagged") {
    const sinceMinutes = getIntegerOption(
      parsed.options,
      "since-minutes",
      0,
    );
    if (sinceMinutes <= 0) {
      throw new Error("--since-minutes must be greater than 0");
    }

    const scheduledTarget = await resolveScheduledTarget(clients, config);
    const repository = await resolveEcrRepository(
      scheduledTarget.containerImage,
    );
    const ecr = new ECRClient({ region: config.region });
    const result = await cleanupRecentUntaggedImages({
      client: ecr,
      repository,
      sinceMinutes,
    });
    writeJson({
      command: "image cleanup-untagged",
      region: config.region,
      ...result,
    });
    return;
  }

  if (domain === "deploy" && action === "scheduled") {
    const imageUri = requireStringOption(parsed.options, "image-uri");
    if (!getBooleanOption(parsed.options, "confirm-production")) {
      throw new Error(
        "Refusing to deploy scheduled production stack without --confirm-production",
      );
    }

    const result = await deployScheduledStack({ clients, config, imageUri });
    writeJson({
      command: "deploy scheduled",
      region: config.region,
      imageUri,
      ...result,
    });
    return;
  }

  if (domain === "task" && action === "run-dry-run") {
    const imageUri = getStringOption(parsed.options, "image-uri");
    const scheduledTarget = await resolveScheduledTarget(clients, config);
    const result = await runDryRunTask({
      clients,
      scheduledTarget,
      imageUri,
      scraperSites: parseSitesOption(parsed.options),
      wait: getBooleanOption(parsed.options, "wait"),
    });
    writeJson({
      command: "task run-dry-run",
      region: config.region,
      ...result,
    });
    return;
  }

  if (domain === "task" && action === "logs") {
    const taskArnOrId =
      getStringOption(parsed.options, "task-arn") ??
      getStringOption(parsed.options, "task-id");
    if (!taskArnOrId) {
      throw new Error("Missing required option --task-arn or --task-id");
    }

    const scheduledTarget = await resolveScheduledTarget(clients, config);
    const logs = await getTaskLogs({
      client: new CloudWatchLogsClient({ region: config.region }),
      scheduledTarget,
      taskArnOrId,
      logGroupName: getStringOption(parsed.options, "log-group"),
      tail: getIntegerOption(parsed.options, "tail", 200),
    });
    writeJson({
      command: "task logs",
      region: config.region,
      ...logs,
    });
    return;
  }

  throw new Error(`Unknown command: ${parsed.commandPath.join(" ") || "(none)"}`);
}

async function assertImageIsNotScheduled(params: {
  ecr: ECRClient;
  repositoryName: string;
  tag: string;
  scheduledImageUri: string;
}): Promise<void> {
  const scheduled = parseEcrImageUri(params.scheduledImageUri);
  if (scheduled.repositoryName !== params.repositoryName) return;
  if (scheduled.tag === params.tag) {
    throw new Error(
      `Refusing to delete ${params.repositoryName}:${params.tag}; it is used by the scheduled task. Use --force to override.`,
    );
  }

  const image = await describeImageByTag(
    params.ecr,
    params.repositoryName,
    params.tag,
  );
  if (scheduled.digest && image.imageDigest === scheduled.digest) {
    throw new Error(
      `Refusing to delete ${params.repositoryName}:${params.tag}; its digest is used by the scheduled task. Use --force to override.`,
    );
  }
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  logProgress(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
