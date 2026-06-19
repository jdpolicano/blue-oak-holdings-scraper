import {
  BatchDeleteImageCommand,
  DescribeImagesCommand,
  ECRClient,
  GetAuthorizationTokenCommand,
  type ImageDetail,
  type ImageIdentifier,
} from "@aws-sdk/client-ecr";
import { Buffer } from "node:buffer";
import { requireValue, type AwsOpsConfig } from "./config.js";
import { runProcess } from "./process.js";

export interface EcrImageUriParts {
  accountId: string;
  region: string;
  repositoryName: string;
  repositoryUri: string;
  tag?: string;
  digest?: string;
}

export interface EcrRepository {
  repositoryName: string;
  repositoryUri: string;
}

export interface BuildPushResult {
  repository: EcrRepository;
  tag: string;
  tagUri: string;
  imageUri: string;
  digest: string;
  pushedAt?: string;
}

export interface DeleteImageResult {
  repository: EcrRepository;
  tag: string;
  deleted: unknown[];
  failures: unknown[];
}

export interface CleanupUntaggedResult {
  repository: EcrRepository;
  sinceMinutes: number;
  cutoff: string;
  candidates: Array<{
    imageDigest: string;
    imagePushedAt?: string;
    imageSizeInBytes?: number;
  }>;
  deleted: unknown[];
  failures: unknown[];
}

export function parseEcrImageUri(imageUri: string): EcrImageUriParts {
  const match = imageUri.match(
    /^(?<accountId>\d+)\.dkr\.ecr\.(?<region>[^.]+)\.amazonaws\.com\/(?<repositoryName>[^:@]+(?:\/[^:@]+)*)(?::(?<tag>[^@]+))?(?:@(?<digest>.+))?$/,
  );
  if (!match?.groups) {
    throw new Error(`Image URI is not an ECR image URI: ${imageUri}`);
  }

  const { accountId, region, repositoryName, tag, digest } = match.groups;
  return {
    accountId,
    region,
    repositoryName,
    repositoryUri: `${accountId}.dkr.ecr.${region}.amazonaws.com/${repositoryName}`,
    tag,
    digest,
  };
}

export async function resolveEcrRepository(
  scheduledImageUri: string | undefined,
): Promise<EcrRepository> {
  const repositoryUri = process.env.ECR_REPOSITORY_URI;
  if (repositoryUri) {
    const parsed = parseEcrImageUri(repositoryUri);
    return {
      repositoryName: parsed.repositoryName,
      repositoryUri: parsed.repositoryUri,
    };
  }

  const repositoryName = process.env.ECR_REPOSITORY_NAME;
  if (repositoryName) {
    const scheduled = scheduledImageUri
      ? parseEcrImageUri(scheduledImageUri)
      : undefined;
    if (!scheduled) {
      throw new Error(
        "ECR_REPOSITORY_NAME requires a scheduled task image or ECR_REPOSITORY_URI to derive the registry",
      );
    }
    return {
      repositoryName,
      repositoryUri: `${scheduled.accountId}.dkr.ecr.${scheduled.region}.amazonaws.com/${repositoryName}`,
    };
  }

  if (!scheduledImageUri) {
    throw new Error(
      "Unable to derive ECR repository without a scheduled task image. Set ECR_REPOSITORY_URI.",
    );
  }

  const parsed = parseEcrImageUri(scheduledImageUri);
  return {
    repositoryName: parsed.repositoryName,
    repositoryUri: parsed.repositoryUri,
  };
}

export async function buildAndPushImage(params: {
  client: ECRClient;
  config: AwsOpsConfig;
  repository: EcrRepository;
  tag: string;
}): Promise<BuildPushResult> {
  const tagUri = `${params.repository.repositoryUri}:${params.tag}`;
  await dockerLogin(params.client, params.repository.repositoryUri);
  await runProcess(
    "docker",
    [
      "buildx",
      "build",
      "--platform",
      params.config.dockerPlatform,
      "--tag",
      tagUri,
      "--push",
      ".",
    ],
    { progress: `Building and pushing ${tagUri}` },
  );

  const image = await describeImageByTag(
    params.client,
    params.repository.repositoryName,
    params.tag,
  );
  const digest = requireValue(
    image.imageDigest,
    `ECR image ${tagUri} does not include a digest`,
  );

  return {
    repository: params.repository,
    tag: params.tag,
    tagUri,
    imageUri: `${params.repository.repositoryUri}@${digest}`,
    digest,
    pushedAt: image.imagePushedAt?.toISOString(),
  };
}

export async function deleteImageByTag(params: {
  client: ECRClient;
  repository: EcrRepository;
  tag: string;
}): Promise<DeleteImageResult> {
  const result = await params.client.send(
    new BatchDeleteImageCommand({
      repositoryName: params.repository.repositoryName,
      imageIds: [{ imageTag: params.tag }],
    }),
  );

  return {
    repository: params.repository,
    tag: params.tag,
    deleted: result.imageIds ?? [],
    failures: result.failures ?? [],
  };
}

export async function cleanupRecentUntaggedImages(params: {
  client: ECRClient;
  repository: EcrRepository;
  sinceMinutes: number;
}): Promise<CleanupUntaggedResult> {
  const cutoff = new Date(Date.now() - params.sinceMinutes * 60 * 1000);
  const candidates: ImageDetail[] = [];
  let nextToken: string | undefined;

  do {
    const result = await params.client.send(
      new DescribeImagesCommand({
        repositoryName: params.repository.repositoryName,
        filter: { tagStatus: "UNTAGGED" },
        maxResults: 100,
        nextToken,
      }),
    );
    candidates.push(
      ...(result.imageDetails ?? []).filter(
        (image) =>
          image.imageDigest &&
          image.imagePushedAt &&
          image.imagePushedAt >= cutoff,
      ),
    );
    nextToken = result.nextToken;
  } while (nextToken);

  if (!candidates.length) {
    return {
      repository: params.repository,
      sinceMinutes: params.sinceMinutes,
      cutoff: cutoff.toISOString(),
      candidates: [],
      deleted: [],
      failures: [],
    };
  }

  const deleted: unknown[] = [];
  const failures: unknown[] = [];
  for (const chunk of chunkImageIds(
    candidates.map((image) => ({ imageDigest: image.imageDigest! })),
  )) {
    const result = await params.client.send(
      new BatchDeleteImageCommand({
        repositoryName: params.repository.repositoryName,
        imageIds: chunk,
      }),
    );
    deleted.push(...(result.imageIds ?? []));
    failures.push(...(result.failures ?? []));
  }

  return {
    repository: params.repository,
    sinceMinutes: params.sinceMinutes,
    cutoff: cutoff.toISOString(),
    candidates: candidates.map((image) => ({
      imageDigest: image.imageDigest!,
      imagePushedAt: image.imagePushedAt?.toISOString(),
      imageSizeInBytes: image.imageSizeInBytes,
    })),
    deleted,
    failures,
  };
}

export async function describeImageByTag(
  client: ECRClient,
  repositoryName: string,
  tag: string,
): Promise<ImageDetail> {
  const result = await client.send(
    new DescribeImagesCommand({
      repositoryName,
      imageIds: [{ imageTag: tag }],
    }),
  );
  return requireValue(
    result.imageDetails?.[0],
    `ECR image ${repositoryName}:${tag} was not found`,
  );
}

async function dockerLogin(
  client: ECRClient,
  repositoryUri: string,
): Promise<void> {
  const result = await client.send(new GetAuthorizationTokenCommand({}));
  const authorizationData = requireValue(
    result.authorizationData?.[0],
    "ECR authorization response did not include credentials",
  );
  const token = requireValue(
    authorizationData.authorizationToken,
    "ECR authorization response did not include a token",
  );
  const endpoint = authorizationData.proxyEndpoint ?? `https://${repositoryUri}`;
  const decoded = Buffer.from(token, "base64").toString("utf-8");
  const password = requireValue(
    decoded.split(":")[1],
    "ECR authorization token did not include a password",
  );

  await runProcess(
    "docker",
    ["login", "--username", "AWS", "--password-stdin", endpoint],
    { input: `${password}\n`, progress: `Logging in to ${endpoint}` },
  );
}

function chunkImageIds(imageIds: ImageIdentifier[]): ImageIdentifier[][] {
  const chunks: ImageIdentifier[][] = [];
  for (let idx = 0; idx < imageIds.length; idx += 100) {
    chunks.push(imageIds.slice(idx, idx + 100));
  }
  return chunks;
}
