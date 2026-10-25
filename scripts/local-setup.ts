import { randomBytes } from "node:crypto";
import { parse } from "dotenv";
import { restrictLocalPorts } from "./local-docker";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function run(args: string[], silent = false) {
  const result = spawnSync(args[0], args.slice(1), {
    encoding: "utf8",
    stdio: silent ? "pipe" : "inherit",
  });
  if (result.status !== 0)
    throw new Error(`${args[0]} failed. Ensure Docker is running and retry.`);
  return result.stdout;
}
run(["docker", "info"], true);
const network = "accessly-local";
const foundNetwork = spawnSync("docker", ["network", "inspect", network], {
  stdio: "ignore",
});
if (foundNetwork.status !== 0)
  run(
    [
      "docker",
      "network",
      "create",
      "-o",
      "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
      network,
    ],
    true,
  );
console.log(
  "Starting local database, authentication, mail, and private storage…",
);
run(
  [
    "pnpm",
    "exec",
    "supabase",
    "start",
    "--network-id",
    network,
    "--exclude",
    "studio,realtime,edge-runtime,logflare,vector,supavisor",
  ],
  true,
);
run(["docker", "compose", "-f", "infra/compose.yaml", "up", "-d"]);
await restrictLocalPorts();
const status = JSON.parse(
  run(["pnpm", "exec", "supabase", "status", "-o", "json"], true),
);
if (!existsSync("apps/extension/identity.json"))
  run(["pnpm", "--filter", "@accessly/extension", "build"]);
const identity = JSON.parse(
  readFileSync("apps/extension/identity.json", "utf8"),
);
const previous = existsSync(".env.local")
  ? parse(readFileSync(".env.local", "utf8"))
  : {};
const secretKeys =
  previous.JOURNEY_SECRET_KEYS ??
  JSON.stringify({ local_v1: randomBytes(32).toString("base64") });
const content =
  [
    `DATABASE_URL=postgresql://accessly_api:accessly-local-only@127.0.0.1:54322/postgres`,
    `DATABASE_ADMIN_URL=${status.DB_URL}`,
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    "REDIS_URL=redis://127.0.0.1:6379",
    "WEB_ORIGIN=http://127.0.0.1:3000",
    `EXTENSION_ID=${identity.id}`,
    "WORKER_FIXTURE_ORIGIN=http://127.0.0.1:4174",
    "WORKER_CONCURRENCY=2",
    `JOURNEY_SECRET_KEY_ID=${previous.JOURNEY_SECRET_KEY_ID ?? "local_v1"}`,
    `JOURNEY_SECRET_KEYS='${secretKeys}'`,
  ].join("\n") + "\n";
if (existsSync(".env.local")) {
  const old = readFileSync(".env.local", "utf8");
  if (!old.includes("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"))
    throw new Error(
      "Existing .env.local uses a different service. Keep it safe and move it aside before configuring this local stack.",
    );
}
writeFileSync(".env.local", content, { mode: 0o600 });
run(["pnpm", "db:migrate"]);
const supabase = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
let authReady = false;
for (let attempt = 0; attempt < 30; attempt++) {
  const { error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });
  if (!error) {
    authReady = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!authReady)
  throw new Error(
    "Local Auth has not reconnected to PostgreSQL. Retry local:setup.",
  );
const { data: buckets, error } = await supabase.storage.listBuckets();
if (error) throw new Error("Could not configure private evidence storage.");
if (!buckets.some((b) => b.id === "evidence")) {
  const { error } = await supabase.storage.createBucket("evidence", {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png"],
  });
  if (error) throw error;
}
run(["pnpm", "--filter", "@accessly/extension", "build"]);
console.log(
  "Local setup complete. Run pnpm dev. No hosted credentials or AI keys are required. Local keys are saved only in ignored .env.local.",
);
