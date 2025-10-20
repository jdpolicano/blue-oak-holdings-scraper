// import { z } from "zod";
// import yaml from "yaml";
// import fs from "node:fs/promises";

// const selectorStrategies = z.enum(["locator", "title", "text"]);
// const filterStrategies = z.enum(["visible"]);
// const valueTypes = z.enum(["text", "attribute"]);
// const methodTypes = z.enum(["exists", "enabled"]);

// // describes the value being parsed.
// const valueSchema = z.object({
//   type: valueTypes,
//   value: z.string(),
// });

// // describes an element in the config
// const elementSchema = z.object({
//   selector: z.string(),
//   strategy: selectorStrategies,
//   filter: filterStrategies.optional(),
//   nth: z.number().optional(),
// });

// //
// const elementWithValueSchema = elementSchema.extend({
//   value: valueSchema,
// });

// const elementsSchema = z.object({
//   title: elementWithValueSchema,
//   href: elementWithValueSchema,
// });

// // describes the schema for getting an array of containers.
// const containerSchema = elementSchema.extend({
//   elements: elementsSchema,
// });

// // describes the pagination schema
// const paginationSchema = elementSchema.extend({
//   method: methodTypes,
// });

// // describes a target.
// const targetSchema = z.object({
//   name: z.string(),
//   pagination: paginationSchema.optional(),
//   container: containerSchema,
// });

// //
// const siteSchema = z.object({
//   url: z.string(),
//   path: z.string(),
//   target: targetSchema,
// });

// //
// const sitesSchema = z.record(z.string(), siteSchema);

// //
// const configSchema = z.object({
//   version: z.number(),
//   sites: sitesSchema,
// });

// //
// export type Value = z.infer<typeof valueSchema>;
// export type Element = z.infer<typeof elementSchema>;
// export type ElementWithValue = z.infer<typeof elementWithValueSchema>;
// export type Container = z.infer<typeof containerSchema>;
// export type ValueStrategy = z.infer<typeof valueTypes>;
// export type SelectorStrategy = z.infer<typeof selectorStrategies>;
// export type FilterStrategy = z.infer<typeof filterStrategies>;
// export type MethodTypes = z.infer<typeof methodTypes>;
// export type ElementNames = keyof z.infer<typeof elementsSchema>;
// export type Pagination = z.infer<typeof paginationSchema>;
// export type SiteConfig = z.infer<typeof siteSchema>;
// export type ProgramConfig = z.infer<typeof configSchema>;

// //
// export const getConfig = async (): Promise<ProgramConfig> => {
//   const config = await fs.readFile("./config/sites.yml", "utf-8");
//   const parsed = yaml.parse(config);
//   return configSchema.parse(parsed);
// };
