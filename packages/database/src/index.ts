import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
export * from "./schema";
export { and, eq, desc, isNull, lt, sql, inArray } from "drizzle-orm";
const globalDb = globalThis as unknown as {
  accesslySql?: ReturnType<typeof postgres>;
};
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing. Run pnpm local:setup.");
  const client = (globalDb.accesslySql ??= postgres(url, {
    max: 8,
    prepare: false,
    onnotice: () => {},
  }));
  return drizzle(client, { schema });
}
export async function closeDb() {
  await globalDb.accesslySql?.end();
  delete globalDb.accesslySql;
}
