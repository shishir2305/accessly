import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env.local" });
export default defineConfig({
  schema: "./packages/database/src/schema.ts",
  out: "./packages/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_ADMIN_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
});
