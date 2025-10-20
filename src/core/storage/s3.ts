import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
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
    }
  }

  async finalize(): Promise<Listing[]> {
    if (this.newListings.length === 0) {
      this.logger.info("No new listings to append.");
      return [];
    }

    this.logger.info(`Streaming merge to s3://${this.bucket}/${this.key}`);

    const parser = parse({ columns: true, skip_empty_lines: true });
    const stringifier = stringify({ header: true });
    const pass = new PassThrough();

    const uploadPromise = this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key,
        Body: pass,
        ContentType: "text/csv",
      }),
    );

    try {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key }),
      );
      const existingStream = res.Body as Readable;

      await pipeline(
        existingStream,
        parser,
        async function* (this: S3StorageStreamed, source: any) {
          for await (const record of source) yield record;
          for (const listing of this.newListings) yield listing;
        }.bind(this),
        stringifier,
        pass,
      );
    } catch (err: any) {
      this.logger.error(err);
      if (err.name === "NoSuchKey") {
        this.logger.error("No existing CSV found");
      }
      pass.end();
      throw err;
    }
    await uploadPromise;
    this.logger.info("Upload complete (streamed).");
    return this.newListings;
  }
}
