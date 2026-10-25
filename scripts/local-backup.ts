import { mkdir, writeFile, readFile, chmod, copyFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { docker, localContainers, engine } from "./local-docker";
const mode = process.argv[2] ?? "create";
const directory = path.resolve(
  process.argv[3] ??
    `artifacts/backups/${new Date().toISOString().replaceAll(":", "-")}`,
);
const digest = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");
const countsSql =
  "select json_build_object('findings',(select count(*) from public.findings),'verifications',(select count(*) from public.verifications),'users',(select count(*) from auth.users),'evidence',(select count(*) from public.evidence))";
if (mode === "create") {
  const active = await fetch("http://127.0.0.1:3000/api/v1/health")
    .then(() => true)
    .catch(() => false);
  if (active)
    throw new Error("Stop pnpm dev before taking a consistent offline backup.");
  const containers = localContainers(),
    db = containers.find((c) => c.Name === "/supabase_db_accessly");
  if (!db) throw new Error("Local database is unavailable.");
  await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
  await mkdir(directory, { recursive: false, mode: 0o700 });
  const counts = JSON.parse(
    docker([
      "exec",
      db.Id,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atc",
      countsSql,
    ]),
  );
  const running = containers
    .filter((c) => c.State.Running)
    .sort((a, b) => Number(a.Id === db.Id) - Number(b.Id === db.Id));
  const volumes = [
    ...new Set<string>(
      containers.flatMap((c) =>
        c.Mounts.filter((m: any) => m.Type === "volume").map(
          (m: any) => m.Name,
        ),
      ),
    ),
  ];
  const files: Record<string, string> = {};
  try {
    for (const c of running)
      await engine("POST", `/containers/${c.Id}/stop?t=30`);
    for (const volume of volumes) {
      if (!/^supabase_[a-z_]+_accessly$/.test(volume))
        throw new Error("Unexpected volume; backup stopped safely.");
      const file = `${volume}.tgz`;
      docker([
        "run",
        "--rm",
        "--network",
        "none",
        "--user",
        "0",
        "--entrypoint",
        "tar",
        "--mount",
        `type=volume,src=${volume},dst=/source,readonly`,
        "--mount",
        `type=bind,src=${directory},dst=/backup`,
        db.Config.Image,
        "-czf",
        `/backup/${file}`,
        "-C",
        "/source",
        ".",
      ]);
      await chmod(path.join(directory, file), 0o600);
      files[file] = digest(await readFile(path.join(directory, file)));
    }
    await copyFile(".env.local", path.join(directory, "env.local"));
    await chmod(path.join(directory, "env.local"), 0o600);
    files["env.local"] = digest(
      await readFile(path.join(directory, "env.local")),
    );
    await writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          project: "accessly",
          volumes,
          files,
          dbConfig: db.Config,
          counts,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(`Private offline backup created: ${directory}`);
  } finally {
    for (const c of [...running].reverse())
      await engine("POST", `/containers/${c.Id}/start`).catch(() => {
        process.exitCode = 1;
        console.error(
          `Could not restart ${c.Name.slice(1)}; inspect local service health before continuing.`,
        );
      });
  }
} else if (mode === "verify") {
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  if (manifest.version !== 1 || manifest.project !== "accessly")
    throw new Error("Unsupported backup.");
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (
      path.basename(file) !== file ||
      digest(await readFile(path.join(directory, file))) !== hash
    )
      throw new Error("Backup integrity check failed.");
  }
  const id = randomUUID().slice(0, 8),
    volume = `accessly-restore-check-${id}`,
    name = `accessly-restore-check-${id}`;
  docker(["volume", "create", volume]);
  try {
    docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--user",
      "0",
      "--entrypoint",
      "tar",
      "--mount",
      `type=volume,src=${volume},dst=/restore`,
      "--mount",
      `type=bind,src=${directory},dst=/backup,readonly`,
      manifest.dbConfig.Image,
      "-xzf",
      "/backup/supabase_db_accessly.tgz",
      "-C",
      "/restore",
    ]);
    const clone = await engine("POST", `/containers/create?name=${name}`, {
      ...manifest.dbConfig,
      HostConfig: {
        NetworkMode: "none",
        Mounts: [
          {
            Type: "volume",
            Source: volume,
            Target: "/var/lib/postgresql/data",
          },
        ],
      },
    });
    await engine("POST", `/containers/${clone.Id}/start`);
    let actual: unknown;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        actual = JSON.parse(
          docker([
            "exec",
            name,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-Atc",
            countsSql,
          ]),
        );
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (JSON.stringify(actual) !== JSON.stringify(manifest.counts))
      throw new Error(
        "Restored database counts differ or the isolated database could not start.",
      );
    console.log(
      "Backup hashes and isolated PostgreSQL restore verified, including Auth users, findings, verification history, and evidence metadata. No live data changed. Storage archives passed integrity checks; recheck signed downloads after an actual recovery.",
    );
  } finally {
    docker(["rm", "-f", name]);
    docker(["volume", "rm", volume]);
  }
} else
  throw new Error(
    "Use create or verify. See docs/OPERATIONS.md for offline recovery.",
  );
