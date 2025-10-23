import { Listing } from "../models/listing.js";
/**
 * This is an interface over any storage mechanism.
 * The idea is this could be a local, file-backed, csv file
 * or an s3 bucket or a database. It simply defines how to retrieve
 * information.
 */
export interface Storage {
  // optional method to close the storage early or cleanup resources.
  close?(): Promise<void>;
  // Finalize the storage, e.g., close file handles, db connections, etc
  finalize(): Promise<Listing[]>;
  // add a new listing to the storage. The storage is responsible
  // for deduplication if needed.
  appendListing(...listing: Listing[]): Promise<void>;
  // check if a listing with the given id exists.
  hasListing?(id: string): Promise<boolean>;
}

export { MemoryStorage } from "./memory.js";
export { S3StorageStreamed } from "./s3.js";
