import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { parse, stringify } from "csv";
import { pipeline } from "stream/promises";
import { Readable, PassThrough } from "stream";
import { Logger } from "pino";
import { Listing } from "../models/listing.js";
import { Storage } from "./index.js";

export class S3StorageStreamed implements Storage {
  private s3 = new S3Client({});
  private bucket: string;
  private key: string;
  private idsSet = new Set<string>();
  private newListings: Listing[] = [];
  private logger: Logger;

  constructor(bucket: string, key: string, logger: Logger) {
    this.bucket = bucket;
    this.key = key;
    this.logger = logger.child({ component: S3StorageStreamed.name });
  }

  static async create(
    bucket: string,
    key: string,
    logger: Logger,
  ): Promise<S3StorageStreamed> {
    const store = new S3StorageStreamed(bucket, key, logger);
    try {
      const res = await store.s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const parser = parse({ columns: true, skip_empty_lines: true });
      const inputStream = res.Body as Readable;
      await pipeline(inputStream, parser, async function* (source) {
        for await (const record of source) store.idsSet.add(record.id);
      });
    } catch (err: any) {
      logger.error(err);
      if (err.name === "NoSuchKey") {
        logger.error("No existing CSV found");
      }
      throw err;
    }
    return store;
  }

  async appendListing(...listings: Listing[]): Promise<void> {
    for (const listing of listings) {
      if (this.idsSet.has(listing.id)) continue;
      this.newListings.push(listing);
      this.idsSet.add(listing.id);
    }
  }
  /** Main entrypoint — orchestrates merge + upload */
  /** Main entrypoint — orchestrates merge + upload */
  async finalize(): Promise<Listing[]> {
    if (this.newListings.length === 0) {
      this.logger.info("No new listings to append.");
      return [];
    }

    this.logger.info(`Streaming merge to s3://${this.bucket}/${this.key}`);

    const tempKey = this.getTempKey();

    try {
      await this.streamMergeToTemp(tempKey);
      await this.replaceOriginalWithTemp(tempKey);
      this.logger.info(
        `Appended ${this.newListings.length} new listings to s3://${this.bucket}/${this.key}`,
      );
      return this.newListings;
    } catch (err: any) {
      this.logger.error(
        err,
        "Error during finalize, will attempt cleaning up temp file",
      );
      await this.cleanupTempKey(tempKey);
      // if the problem was the cleanup, it will blow this up again
      // if not, we re-throw the original error
      throw err;
    }
  }

  /** Builds a unique temporary key name for safe overwrite */
  private getTempKey(): string {
    return `${this.key}.tmp-${Date.now()}`;
  }

  /** Downloads existing CSV (if any), merges new listings, and uploads to a temp object */
  private async streamMergeToTemp(tempKey: string): Promise<void> {
    const pass = new PassThrough();
    const uploadPromise = this.uploadTempFile(tempKey, pass);

    try {
      const existing = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key }),
      );
      const existingStream = existing.Body as Readable;
      await this.mergeCsvStreams(existingStream, pass);
    } catch (err: any) {
      if (err.name === "NoSuchKey") {
        this.logger.info("No existing file found, creating new CSV");
        await this.writeNewCsv(pass);
      } else {
        pass.end();
        throw err;
      }
    }

    await uploadPromise;
  }

  /** Pipes existing + new records into a CSV stream */
  private async mergeCsvStreams(
    source: Readable,
    destination: PassThrough,
  ): Promise<void> {
    await pipeline(
      source,
      parse({ columns: true, skip_empty_lines: true }),
      async function* (this: S3StorageStreamed, parsed: any) {
        for await (const record of parsed) yield record;
        for (const listing of this.newListings) yield listing;
      }.bind(this),
      stringify({ header: true }),
      destination,
    );
  }

  /** Uploads the temp object to S3 */
  private async uploadTempFile(
    tempKey: string,
    body: PassThrough,
  ): Promise<void> {
    // use upload from lib-storage for multipart upload support
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: tempKey,
        Body: body,
        ContentType: "text/csv",
      },
    });
    await upload.done();
  }

  /** Writes only new listings when the original file doesn't exist */
  private async writeNewCsv(destination: PassThrough): Promise<void> {
    const csvStringifier = stringify({ header: true });
    await pipeline(
      Readable.from(this.newListings),
      csvStringifier,
      destination,
    );
  }

  /** Replaces the original object with the temp one atomically */
  private async replaceOriginalWithTemp(tempKey: string): Promise<void> {
    this.logger.info(
      `Replacing original s3://${this.bucket}/${this.key} with temp file s3://${this.bucket}/${tempKey}`,
    );
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${tempKey}`,
        Key: this.key,
      }),
    );
    this.logger.info(`Successfully replaced original file.`);
    await this.cleanupTempKey(tempKey);
  }

  /** Deletes the temp object */
  private async cleanupTempKey(tempKey: string): Promise<void> {
    try {
      this.logger.info(`Cleaning up temp key s3://${this.bucket}/${tempKey}`);
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: tempKey,
        }),
      );
      this.logger.info(`Successfully deleted temp key.`);
    } catch (err) {
      this.logger.warn(err, `Failed to clean up temp key ${tempKey}:`);
    }
  }
}
