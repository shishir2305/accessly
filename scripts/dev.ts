import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
if (!existsSync(".env.local")) {
  console.error("Run pnpm local:setup first.");
  process.exit(1);
}
const tasks = [
  [
    "web",
    [
      "--filter",
      "@accessly/web",
      process.env.ACCESSLY_SERVER_MODE === "production" ? "start" : "dev",
    ],
  ],
  ["worker", ["dev:worker"]],
  ["fixtures", ["dev:fixtures"]],
] as const;
const children = tasks.map(([label, args]) => {
  const child = spawn("pnpm", [...args], {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout?.on("data", (data) =>
    process.stdout.write(`[${label}] ${data}`),
  );
  child.stderr?.on("data", (data) =>
    process.stderr.write(`[${label}] ${data}`),
  );
  return child;
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
for (const child of children)
  child.on("exit", (code) => {
    if (!stopping && code) {
      stop();
      process.exitCode = code;
    }
  });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
