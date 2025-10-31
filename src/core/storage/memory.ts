import { Storage } from "./index.js";
import { Listing } from "../models/listing.js";
import fs from "fs";
import { parse, stringify } from "csv";
import { Logger } from "pino";
import path from "node:path";
import { pipeline } from "stream/promises";

/**
 * MemoryStorage is an implementation of the Storage interface that uses an in-memory Set
 * to track unique listing IDs and a list to store new listings. It avoids loading the entire
 * CSV file into memory by streaming the file and processing it incrementally.
 *
 * Key Features:
 * - Deduplication: Uses a Set to track existing IDs, ensuring no duplicate listings are added.
 * - Streaming: Processes the CSV file as a stream to minimize memory usage.
 * - Finalization: Merges new listings with the existing file on disk in a memory-efficient way.
 *
 * Important Notes:
 * - This class assumes that the CSV file exists and is formatted correctly with a header row.
 * - The `id` field in the CSV is used as the unique identifier for deduplication.
 * - The `finalize` method writes to a temporary file first and then replaces the original file.
 * - Be cautious of race conditions if multiple instances of this class are used on the same file.
 */
export class MemoryStorage implements Storage {
  private idsSet: Set<string> = new Set(); // Tracks unique IDs for deduplication
  private newListings: Listing[] = []; // Stores new listings to be appended
  private logger: Logger; // Logger instance for structured logging
  private filePath: string; // Path to the CSV file being managed

  /**
   * Private constructor to enforce the use of the async `create` method.
   * @param filePath - Path to the CSV file.
   * @param logger - Logger instance for logging.
   */
  private constructor(filePath: string, logger: Logger) {
    this.logger = logger.child({ component: MemoryStorage.name });
    this.filePath = filePath;
  }

  /**
   * Factory method to create an instance of MemoryStorage.
   * Reads the existing CSV file and populates the `idsSet` with existing IDs.
   *
   * @param filePath - Path to the CSV file.
   * @param logger - Logger instance for logging.
   * @returns A Promise that resolves to an instance of MemoryStorage.
   *
   * Gotchas:
   * - Ensure the file exists before calling this method, or it will throw an error.
   * - The CSV file must have an `id` column for this to work correctly.
   */
  static async create(
    filePath: string,
    logger: Logger,
  ): Promise<MemoryStorage> {
    const memStore = new MemoryStorage(filePath, logger);
    const csvData = memStore.getListingsFileStream();
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
    });

    // Stream the CSV file and populate the idsSet with existing IDs
    csvData.pipe(parser);
    for await (const record of parser) {
      memStore.idsSet.add(record.id);
    }
    return memStore;
  }

  /**
   * Gets the listings file read stream and creates a new one if it doesn't exist.
   *
   * @returns A ReadStream for the listings CSV file.
   *
   */
  private getListingsFileStream(): fs.ReadStream {
    if (!fs.existsSync(this.filePath)) {
      this.logger.warn(
        `Listings file not found at ${this.filePath}. Creating a new one.`,
      );
      fs.writeFileSync(this.filePath, "");
    }
    return fs.createReadStream(this.filePath, {
      encoding: "utf-8",
    });
  }

  /**
   * Checks if a listing with the given ID already exists.
   *
   * @param id - The ID of the listing to check.
   * @returns A Promise that resolves to true if the listing exists, false otherwise.
   */
  async hasListing(id: string): Promise<boolean> {
    return this.idsSet.has(id);
  }

  /**
   * Appends new listings to the in-memory storage if they don't already exist.
   *
   * @param listings - One or more listings to append.
   *
   * Gotchas:
   * - Listings with duplicate IDs are skipped and logged at the debug level.
   * - This method does not immediately write to disk; call `finalize` to persist changes.
   */
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

  /**
   * Finalizes the storage by appending new listings to the CSV file on disk.
   *
   * - Reads the existing file and streams its content.
   * - Appends new listings to the stream.
   * - Writes the combined data to a temporary file and replaces the original file.
   *
   * @returns A Promise that resolves to the list of new listings that were appended.
   *
   * Gotchas:
   * - If no new listings are present, this method does nothing and logs a message.
   * - The temporary file is created in the same directory as the original file.
   * - If the process is interrupted, the temporary file may be left behind.
   */
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
      // Read the existing file as a stream
      fs.createReadStream(this.filePath, { encoding: "utf-8" }),
      // Parse the existing CSV into objects
      parse({ columns: true, skip_empty_lines: true }),
      // Append the current listings first, then the new listings
      async function* (this: MemoryStorage, source: any) {
        for await (const record of source) yield record; // Yield existing records
        for (const listing of this.newListings) yield listing; // Yield new listings
      }.bind(this),
      // Convert the objects back into a CSV string
      stringify({ header: true }),
      // Write the combined data to a temporary file
      fs.createWriteStream(tempFilePath, { encoding: "utf-8" }),
    );

    // Replace the old file with the new file
    fs.renameSync(tempFilePath, this.filePath);
    this.logger.info(`Successfully appended new listings to ${this.filePath}`);
    return this.newListings;
  }
}
