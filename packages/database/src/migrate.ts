import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
const client = postgres(
  process.env.DATABASE_ADMIN_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { max: 1, onnotice: () => {} },
);
await migrate(drizzle(client), {
  migrationsFolder: "packages/database/migrations",
});
await client.unsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='accessly_api') THEN CREATE ROLE accessly_api LOGIN PASSWORD 'accessly-local-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF; END $$;
GRANT USAGE ON SCHEMA public TO accessly_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO accessly_api;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
`);
const tables =
  await client`select tablename from pg_tables where schemaname='public'`;
for (const t of tables)
  await client.unsafe(
    `ALTER TABLE public."${t.tablename.replaceAll('"', '""')}" ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS accessly_server ON public."${t.tablename.replaceAll('"', '""')}"; CREATE POLICY accessly_server ON public."${t.tablename.replaceAll('"', '""')}" TO accessly_api USING (true) WITH CHECK (true);`,
  );
await client.end();
console.log(
  "Migrations applied; browser roles denied and restricted API role configured.",
);
