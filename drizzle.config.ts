import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.LIFE_DATA_DIR
      ? `${process.env.LIFE_DATA_DIR}/life.db`
      : "./data/life.db",
  },
});
