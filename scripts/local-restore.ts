import { readFile, copyFile, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { parse } from "dotenv";
import { docker, localContainers, engine } from "./local-docker";
const directory = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !process.argv.includes("--replace-local-data"))
  throw new Error(
    "Restore replaces local Auth, records, and screenshots. Stop all app/worker processes, create a safety backup, then use pnpm local:restore <trusted-backup-directory> --replace-local-data.",
  );
if (
  await fetch("http://127.0.0.1:3000/api/v1/health")
    .then(() => true)
    .catch(() => false)
)
  throw new Error("Stop all Accessly processes before restoring.");
const manifest = JSON.parse(
  await readFile(path.join(directory, "manifest.json"), "utf8"),
);
if (manifest.version !== 1 || manifest.project !== "accessly")
  throw new Error("Unsupported backup.");
for (const [file, hash] of Object.entries(manifest.files)) {
  if (
    path.basename(file) !== file ||
    createHash("sha256")
      .update(await readFile(path.join(directory, file)))
      .digest("hex") !== hash
  )
    throw new Error("Backup integrity check failed.");
}
const containers = localContainers(),
  db = containers.find((c) => c.Name === "/supabase_db_accessly");
if (!db || db.Config.Image !== manifest.dbConfig.Image)
  throw new Error(
    "Recovery requires the same local PostgreSQL image as the backup.",
  );
const volumes = new Set(
  containers.flatMap((c) =>
    c.Mounts.filter((m: any) => m.Type === "volume").map((m: any) => m.Name),
  ),
);
if (
  JSON.stringify([...volumes].sort()) !==
  JSON.stringify([...manifest.volumes].sort())
)
  throw new Error("The backup must contain every local Supabase data volume.");
for (const volume of manifest.volumes)
  if (
    !/^supabase_[a-z_]+_accessly$/.test(volume) ||
    !volumes.has(volume) ||
    !manifest.files[`${volume}.tgz`]
  )
    throw new Error("Backup volumes do not match this local workspace.");
const env = parse(await readFile(path.join(directory, "env.local")));
if (
  env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321" ||
  env.REDIS_URL !== "redis://127.0.0.1:6379"
)
  throw new Error("Only the default local stack can be restored by this tool.");
const ordered = [...containers].sort(
  (a, b) => Number(a.Id === db.Id) - Number(b.Id === db.Id),
);
for (const c of ordered)
  if (c.State.Running) await engine("POST", `/containers/${c.Id}/stop?t=30`);
// Volumes were checked against this exact workspace; this command is available only behind the explicit replacement flag.
for (const volume of manifest.volumes) {
  const mounts = ["--mount", `type=volume,src=${volume},dst=/restore`];
  docker([
    "run",
    "--rm",
    "--network",
    "none",
    "--user",
    "0",
    "--entrypoint",
    "find",
    ...mounts,
    db.Config.Image,
    "/restore",
    "-mindepth",
    "1",
    "-delete",
  ]);
  docker([
    "run",
    "--rm",
    "--network",
    "none",
    "--user",
    "0",
    "--entrypoint",
    "tar",
    ...mounts,
    "--mount",
    `type=bind,src=${directory},dst=/backup,readonly`,
    db.Config.Image,
    "-xzf",
    `/backup/${volume}.tgz`,
    "-C",
    "/restore",
  ]);
}
await copyFile(path.join(directory, "env.local"), ".env.local");
await chmod(".env.local", 0o600);
await engine("POST", `/containers/${db.Id}/start`);
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    docker([
      "exec",
      db.Id,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      "UPDATE public.runs SET status='queued',updated_at=now() WHERE status='running' AND mode<>'journey' AND result IS NULL AND cancelled=false; UPDATE public.runs SET status='partial',error='RESTORED_JOURNEY_INTERRUPTED: Review test data and start a new journey. No automatic action retry.',updated_at=now() WHERE mode='journey' AND status IN ('queued','running'); UPDATE public.outbox SET dispatched_at=NULL WHERE run_id IN (SELECT id FROM public.runs WHERE status='queued' AND result IS NULL AND cancelled=false);",
    ]);
    ready = true;
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
if (!ready)
  throw new Error(
    "Restored PostgreSQL did not start. Keep Accessly stopped and inspect Docker health.",
  );
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 }),
  queue = new Queue("assessments", { connection: redis });
try {
  await queue.obliterate({ force: true });
} finally {
  await queue.close();
  await redis.quit();
}
for (const c of [...ordered].reverse())
  if (c.Id !== db.Id) await engine("POST", `/containers/${c.Id}/start`);
console.log(
  "Local data restored. Run pnpm local:setup to check Auth/storage health and rebuild configured clients. Then verify sign-in, a historical finding/verification, a private screenshot download, and a new queued scan. Separately stored backups retain their own copies until removed.",
);
