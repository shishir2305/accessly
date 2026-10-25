import { execFileSync } from "node:child_process";
import http from "node:http";
export function docker(args: string[]) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}
const context = JSON.parse(docker(["context", "inspect"]))[0];
const endpoint = process.env.DOCKER_HOST ?? context.Endpoints.docker.Host;
if (!endpoint.startsWith("unix://"))
  throw new Error("Local operations require a local Docker Unix socket.");
export function engine(
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: endpoint.slice(7),
        path,
        method,
        headers: { "Content-Type": "application/json" },
        timeout: 120000,
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 300)
            reject(new Error(`Docker operation failed (${res.statusCode}).`));
          else resolve(text ? JSON.parse(text) : null);
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () =>
      req.destroy(new Error("Docker operation timed out.")),
    );
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
export function localContainers() {
  const ids = docker([
    "ps",
    "-aq",
    "--filter",
    "label=com.supabase.cli.project=accessly",
  ])
    .split("\n")
    .filter(Boolean);
  if (!ids.length)
    throw new Error("Start the local Accessly Supabase stack first.");
  const containers: any[] = JSON.parse(docker(["inspect", ...ids]));
  if (
    containers.some(
      (c) => c.Config.Labels["com.supabase.cli.workdir"] !== process.cwd(),
    )
  )
    throw new Error("The local stack belongs to a different workspace.");
  return containers;
}
export async function restrictLocalPorts() {
  for (const c of localContainers().sort(
    (a, b) =>
      Number(b.Name === "/supabase_db_accessly") -
      Number(a.Name === "/supabase_db_accessly"),
  )) {
    const bindings = c.HostConfig.PortBindings ?? {};
    if (
      !Object.values(bindings).some((rows: any) =>
        rows.some((r: any) => r.HostIp !== "127.0.0.1"),
      )
    )
      continue;
    const name = c.Name.slice(1),
      oldName = `${name}-before-loopback-${Date.now()}`;
    const networks = Object.entries(c.NetworkSettings.Networks).map(
      ([name, value]: any) => [
        name,
        { Aliases: value.Aliases, DriverOpts: value.DriverOpts },
      ],
    );
    const endpoints = Object.fromEntries(networks);
    await engine("POST", `/containers/${c.Id}/stop?t=30`);
    await engine(
      "POST",
      `/containers/${c.Id}/rename?name=${encodeURIComponent(oldName)}`,
    );
    for (const [network] of networks)
      await engine("POST", `/networks/${network}/disconnect`, {
        Container: c.Id,
      });
    let replacement: string | undefined;
    try {
      const ports = Object.fromEntries(
        Object.entries(bindings).map(([port, rows]: any) => [
          port,
          rows.map((r: any) => ({ ...r, HostIp: "127.0.0.1" })),
        ]),
      );
      const created = await engine(
        "POST",
        `/containers/create?name=${encodeURIComponent(name)}`,
        {
          ...c.Config,
          HostConfig: { ...c.HostConfig, PortBindings: ports },
          NetworkingConfig: { EndpointsConfig: endpoints },
        },
      );
      replacement = created.Id;
      if (name === "supabase_kong_accessly") {
        const archive = execFileSync(
          "docker",
          ["cp", `${c.Id}:/home/kong/.`, "-"],
          { maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
        );
        execFileSync("docker", ["cp", "-", `${replacement}:/home/kong`], {
          input: archive,
          stdio: ["pipe", "pipe", "pipe"],
        });
      }
      await engine("POST", `/containers/${replacement}/start`);
      let healthy = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const current = await engine("GET", `/containers/${replacement}/json`);
        if (
          current.State.Running &&
          (!current.State.Health || current.State.Health.Status === "healthy")
        ) {
          healthy = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!healthy) throw new Error("Local service did not become healthy.");
      await engine("DELETE", `/containers/${c.Id}`);
      console.log(`Bound ${name} to 127.0.0.1.`);
    } catch {
      if (replacement)
        await engine("DELETE", `/containers/${replacement}?force=true`).catch(
          () => {},
        );
      await engine(
        "POST",
        `/containers/${c.Id}/rename?name=${encodeURIComponent(name)}`,
      );
      for (const [network, config] of networks)
        await engine("POST", `/networks/${network}/connect`, {
          Container: c.Id,
          EndpointConfig: config,
        });
      await engine("POST", `/containers/${c.Id}/start`);
      throw new Error(
        "Loopback binding failed; the original local service was restored.",
      );
    }
  }
}
