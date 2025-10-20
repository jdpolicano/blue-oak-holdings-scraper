import { Storage } from "./index.js";
import { Listing } from "../models/listing.js";
import fs from "fs";
import { parse, stringify } from "csv";
import { Logger } from "pino";
import path from "node:path";
import { pipeline } from "stream/promises";

/**
 * The general idea is to avoid reading in the entire file to memory,
 * we stream in the csv file and just store the ids in memory for deduplication.
 * That way we only need to store new listings in memory.
 *
 * At the very end we can find a way to merge the old and new listings
 * into a single csv file on disk.
 */
export class MemoryStorage implements Storage {
  private idsSet: Set<string> = new Set();
  private newListings: Listing[] = [];
  private logger: Logger;
  private filePath: string;

  private constructor(filePath: string, logger: Logger) {
    this.logger = logger.child({ component: MemoryStorage.name });
    this.filePath = filePath;
  }

  static async create(
    filePath: string,
    logger: Logger,
  ): Promise<MemoryStorage> {
    const memStore = new MemoryStorage(filePath, logger);
    const csvData = fs.createReadStream(filePath, { encoding: "utf-8" });
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
    });
    csvData.pipe(parser);
    for await (const record of parser) {
      memStore.idsSet.add(record.id);
    }
    return memStore;
  }

  async hasListing(id: string): Promise<boolean> {
    return this.idsSet.has(id);
  }

  async appendListing(...listings: Listing[]): Promise<void> {
    for (const listing of listings) {
      if (this.idsSet.has(listing.id)) {
        this.logger.debug(listing, `Listing already exists. Skipping.`);
        continue;
      }
      this.newListings.push(listing);
      this.idsSet.add(listing.id);
      this.logger.debug(listing, `Added new listing.`);
    }
  }

  async finalize(): Promise<Listing[]> {
    if (this.newListings.length === 0) {
      this.logger.info("No new listings to append.");
      return [];
    }

    this.logger.info(
      `Appending ${this.newListings.length} new listings to ${this.filePath}`,
    );

    const workDir = path.dirname(this.filePath);
    const workFileName = `working_${Date.now()}.csv`;
    const tempFilePath = path.join(workDir, workFileName);
    await pipeline(
      // read existing file
      fs.createReadStream(this.filePath, { encoding: "utf-8" }),
      // parse existing csv to objects
      parse({ columns: true, skip_empty_lines: true }),
      // append the current listings first, then the new listings
      async function* (this: MemoryStorage, source: any) {
        for await (const record of source) yield record;
        for (const listing of this.newListings) yield listing;
      }.bind(this),
      // stringify back to csv
      stringify({ header: true }),
      // write to temp file
      fs.createWriteStream(tempFilePath, { encoding: "utf-8" }),
    );
    // replace old file with new file
    fs.renameSync(tempFilePath, this.filePath);
    this.logger.info(`Successfully appended new listings to ${this.filePath}`);
    return this.newListings;
  }
}
