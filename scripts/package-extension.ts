import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  createWriteStream,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
const build = spawnSync("pnpm", ["--filter", "@accessly/extension", "build"], {
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
mkdirSync("artifacts", { recursive: true });
const manifest = JSON.parse(
  readFileSync("apps/extension/dist/manifest.json", "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
  throw new Error("Invalid extension package version.");
const artifact = `artifacts/accessly-extension-${manifest.version}.zip`;
const destination = createWriteStream(artifact);
const archive = new ZipArchive({ zlib: { level: 9 } });
archive.on("error", (error) => {
  throw error;
});
archive.pipe(destination);
function add(directory: string, prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name, "en"),
  )) {
    const relative = prefix + entry.name,
      file = path.join(directory, entry.name);
    if (entry.isDirectory()) add(file, relative + "/");
    else if (entry.isFile())
      archive.append(readFileSync(file), {
        name: relative,
        date: new Date("2020-01-01T00:00:00Z"),
        mode: 0o644,
      });
  }
}
add("apps/extension/dist");
await archive.finalize();
await new Promise<void>((resolve) => destination.on("close", resolve));
console.log(`Packaged ${artifact}.`);
