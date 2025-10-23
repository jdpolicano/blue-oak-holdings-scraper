import {
  S3Client,
  GetObjectCommand,
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

/**
 * S3StorageStreamed is a class that provides functionality for managing and appending
 * data to a CSV file stored in an S3 bucket. It uses streaming to handle large files
 * efficiently and ensures atomic updates by using temporary files during the process.
 */
export class S3StorageStreamed implements Storage {
  private s3 = new S3Client({});
  private bucket: string;
  private key: string;
  private idsSet = new Set<string>(); // Tracks existing IDs to prevent duplicates
  private newListings: Listing[] = []; // Stores new listings to be appended
  private logger: Logger;

  /**
   * Constructor for S3StorageStreamed.
   * @param bucket - The name of the S3 bucket.
   * @param key - The key (path) of the CSV file in the bucket.
   * @param logger - Logger instance for logging messages.
   */
  constructor(bucket: string, key: string, logger: Logger) {
    this.bucket = bucket;
    this.key = key;
    this.logger = logger.child({ component: S3StorageStreamed.name });
  }

  /**
   * Factory method to create an instance of S3StorageStreamed.
   * It initializes the instance and loads existing IDs from the CSV file in S3.
   * @param bucket - The name of the S3 bucket.
   * @param key - The key (path) of the CSV file in the bucket.
   * @param logger - Logger instance for logging messages.
   * @returns A promise that resolves to an S3StorageStreamed instance.
   */
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

  /**
   * Adds new listings to the internal buffer, avoiding duplicates based on IDs.
   * @param listings - One or more listings to append.
   */
  async appendListing(...listings: Listing[]): Promise<void> {
    for (const listing of listings) {
      if (this.idsSet.has(listing.id)) continue;
      this.newListings.push(listing);
      this.idsSet.add(listing.id);
    }
  }

  /**
   * Main entry point for finalizing the process.
   * This method orchestrates the merging of new listings with the existing CSV
   * and uploads the updated file back to S3.
   * @returns A promise that resolves to the list of new listings appended.
   */
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
      throw err;
    }
  }

  /**
   * Generates a unique temporary key name for safe overwriting.
   * @returns A string representing the temporary key.
   */
  private getTempKey(): string {
    return `${this.key}.tmp-${Date.now()}`;
  }

  /**
   * Downloads the existing CSV (if any), merges it with new listings, and uploads
   * the result to a temporary object in S3.
   * @param tempKey - The key for the temporary object in S3.
   */
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

  /**
   * Merges existing records with new listings and writes the result to a destination stream.
   * @param source - The readable stream of the existing CSV.
   * @param destination - The writable stream for the merged CSV.
   */
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

  /**
   * Uploads the temporary object to S3 using multipart upload for large files.
   * @param tempKey - The key for the temporary object in S3.
   * @param body - The stream containing the data to upload.
   */
  private async uploadTempFile(
    tempKey: string,
    body: PassThrough,
  ): Promise<void> {
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

  /**
   * Writes only the new listings to a CSV when no existing file is found.
   * @param destination - The writable stream for the new CSV.
   */
  private async writeNewCsv(destination: PassThrough): Promise<void> {
    const csvStringifier = stringify({ header: true });
    await pipeline(
      Readable.from(this.newListings),
      csvStringifier,
      destination,
    );
  }

  /**
   * Replaces the original object in S3 with the temporary one atomically.
   * @param tempKey - The key for the temporary object in S3.
   */
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

  /**
   * Deletes the temporary object from S3.
   * @param tempKey - The key for the temporary object in S3.
   */
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
