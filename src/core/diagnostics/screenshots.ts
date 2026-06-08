import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { Logger } from "pino";
import { Page } from "playwright";
import { ScrapingError } from "../models/error.js";

const SCREENSHOT_CONTENT_TYPE = "image/png";
const PRESIGNED_URL_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

interface ScreenshotDiagnosticsOptions {
  bucket: string;
  dryRun: boolean;
  logger: Logger;
}

export interface ScreenshotArtifact {
  screenshotCapturedAt: string;
  screenshotKey: string;
  screenshotUrl: string;
}

export interface ScreenshotCandidate {
  screenshotCapturedAt: string;
  screenshotKey: string;
  screenshotBody: Uint8Array;
}

export class ScreenshotDiagnostics {
  private readonly s3 = new S3Client({});
  private readonly bucket: string;
  private readonly dryRun: boolean;
  private readonly logger: Logger;
  private readonly runId: string;

  constructor({ bucket, dryRun, logger }: ScreenshotDiagnosticsOptions) {
    this.bucket = bucket;
    this.dryRun = dryRun;
    this.logger = logger.child({ component: ScreenshotDiagnostics.name });
    this.runId = this.createRunId();
  }

  async captureFailure(
    page: Page,
    error: ScrapingError,
  ): Promise<ScreenshotArtifact | null> {
    const candidate = await this.captureFailureCandidate(page, error);
    if (!candidate) return null;
    return this.uploadFailureCandidate(candidate, error);
  }

  async captureFailureCandidate(
    page: Page,
    error: ScrapingError,
  ): Promise<ScreenshotCandidate | null> {
    if (page.isClosed()) {
      this.logger.warn(
        { site: error.site, url: error.url },
        "Skipping screenshot capture because page is closed",
      );
      return null;
    }

    const capturedAt = new Date();
    const key = this.createScreenshotKey(error, capturedAt);

    try {
      const screenshot = await page.screenshot({ fullPage: true });
      return {
        screenshotCapturedAt: capturedAt.toISOString(),
        screenshotKey: key,
        screenshotBody: screenshot,
      };
    } catch (screenshotError) {
      this.logger.warn(
        {
          site: error.site,
          url: error.url,
          key,
          err: screenshotError,
        },
        "Failed to capture failure screenshot",
      );
      return null;
    }
  }

  async uploadFailureCandidate(
    candidate: ScreenshotCandidate,
    error: ScrapingError,
  ): Promise<ScreenshotArtifact | null> {
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: candidate.screenshotKey,
          Body: candidate.screenshotBody,
          ContentType: SCREENSHOT_CONTENT_TYPE,
        }),
      );
      const screenshotUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: candidate.screenshotKey,
        }),
        { expiresIn: PRESIGNED_URL_EXPIRES_SECONDS },
      );

      this.logger.info(
        {
          site: error.site,
          url: error.url,
          bucket: this.bucket,
          key: candidate.screenshotKey,
        },
        "Uploaded failure screenshot",
      );

      return {
        screenshotCapturedAt: candidate.screenshotCapturedAt,
        screenshotKey: candidate.screenshotKey,
        screenshotUrl,
      };
    } catch (screenshotError) {
      this.logger.warn(
        {
          site: error.site,
          url: error.url,
          bucket: this.bucket,
          key: candidate.screenshotKey,
          err: screenshotError,
        },
        "Failed to upload failure screenshot",
      );
      return null;
    }
  }

  private createRunId(): string {
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
    return `run-${timestamp}-${randomUUID()}`;
  }

  private createScreenshotKey(error: ScrapingError, capturedAt: Date): string {
    const modePrefix = this.dryRun
      ? "diagnostics/dry-runs"
      : "diagnostics/screenshots";
    const datePrefix = capturedAt.toISOString().slice(0, 10);
    const timestamp = capturedAt.toISOString().replaceAll(/[:.]/g, "-");
    const site = this.sanitizeKeySegment(error.site);
    const errorType = this.sanitizeKeySegment(error.errorType);

    return `${modePrefix}/${datePrefix}/${this.runId}/${site}/${timestamp}-${errorType}.png`;
  }

  private sanitizeKeySegment(value: string): string {
    return value
      .toLowerCase()
      .replaceAll(/[^a-z0-9-_]+/g, "-")
      .replaceAll(/^-+|-+$/g, "");
  }
}
