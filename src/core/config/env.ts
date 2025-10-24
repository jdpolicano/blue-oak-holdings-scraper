import { envSchema, JSONSchemaType } from "env-schema";

interface Env {
  DRY_RUN: boolean;
  PROGRAM_CONFIG_PATH: string;
}

const schema: JSONSchemaType<Env> = {
  type: "object",
  required: ["PROGRAM_CONFIG_PATH"],
  properties: {
    DRY_RUN: {
      type: "boolean",
      default: false,
    },
    PROGRAM_CONFIG_PATH: {
      type: "string",
      default: "scrape.config.json",
    },
  },
};

export const envConfig = envSchema({
  schema,
});
