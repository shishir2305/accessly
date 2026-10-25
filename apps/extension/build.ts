import { build } from "vite";
import { build as bundle } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { generateKeyPairSync, createHash } from "node:crypto";
import { config } from "dotenv";
config({ path: "../../.env.local" });
const origin = new URL(process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000")
  .origin;
if (!existsSync("identity.json")) {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64");
  const id = createHash("sha256")
    .update(Buffer.from(key, "base64"))
    .digest("hex")
    .slice(0, 32)
    .split("")
    .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
    .join("");
  writeFileSync("identity.json", JSON.stringify({ key, id }, null, 2) + "\n");
}
const identity = JSON.parse(readFileSync("identity.json", "utf8"));
await build({
  configFile: false,
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: "popup.html" },
  },
  define: { __WEB_ORIGIN__: JSON.stringify(origin) },
});
await bundle({
  entryPoints: {
    background: "src/background.ts",
    scanner: "src/injected.ts",
    recorder: "src/recorder.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  define: { __WEB_ORIGIN__: JSON.stringify(origin) },
  minify: true,
});
mkdirSync("dist", { recursive: true });
writeFileSync(
  "dist/manifest.json",
  JSON.stringify(
    {
      manifest_version: 3,
      name: "Accessly — Current-page accessibility",
      version: JSON.parse(readFileSync("package.json", "utf8")).version,
      description:
        "User-initiated accessibility checks with scoped evidence. Target sessions stay in your browser.",
      key: identity.key,
      permissions: ["activeTab", "scripting", "storage", "identity", "alarms"],
      host_permissions: [origin + "/*"],
      action: {
        default_popup: "popup.html",
        default_title: "Scan with Accessly",
      },
      background: { service_worker: "background.js" },
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'none'",
      },
    },
    null,
    2,
  ),
);
console.log(
  `Extension built. Stable ID: ${identity.id}. API origin: ${origin}`,
);
