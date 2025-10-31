import { envSchema, JSONSchemaType } from "env-schema";

interface Env {
  DRY_RUN: boolean;
  CONFIG_PATH: string;
}

const schema: JSONSchemaType<Env> = {
  type: "object",
  required: ["CONFIG_PATH"],
  properties: {
    DRY_RUN: {
      type: "boolean",
      default: false,
    },
    CONFIG_PATH: {
      type: "string",
      default: "./config/scrape.config.json",
    },
  },
};

export const envConfig = envSchema({
  schema,
});
