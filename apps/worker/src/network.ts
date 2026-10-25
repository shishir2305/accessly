import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import type { Socket } from "node:net";
export function publicAddress(address: string) {
  try {
    const ip = ipaddr.process(address);
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export async function resolveTarget(url: URL, fixtureOrigin?: string) {
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("NETWORK_POLICY");
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  const fixture = fixtureOrigin && url.origin === fixtureOrigin;
  if (!fixture && ![80, 443].includes(port)) throw new Error("NETWORK_POLICY");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const records = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await lookup(host, { all: true, verbatim: true });
  if (
    !records.length ||
    (!fixture && records.some((r) => !publicAddress(r.address)))
  )
    throw new Error("NETWORK_POLICY");
  return { address: records[0].address, port, host };
}
export async function startProxy(fixtureOrigin?: string) {
  const sockets = new Set<Socket>();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url!);
      if (url.protocol !== "http:") throw new Error("NETWORK_POLICY");
      const target = await resolveTarget(url, fixtureOrigin);
      const headers: http.OutgoingHttpHeaders = {
        ...req.headers,
        host: url.host,
      };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const upstream = http.request(
        {
          hostname: target.address,
          port: target.port,
          path: url.pathname + url.search,
          method: req.method,
          headers,
        },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.setTimeout(15000, () => upstream.destroy());
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    } catch {
      res.writeHead(403);
      res.end("Target denied by Accessly network policy");
    }
  });
  server.on("connect", async (req, client, head) => {
    try {
      const url = new URL(`https://${req.url}`);
      const target = await resolveTarget(url, fixtureOrigin);
      const upstream = net.connect(target.port, target.address);
      sockets.add(upstream);
      upstream.on("close", () => sockets.delete(upstream));
      upstream.setTimeout(20000, () => upstream.destroy());
      upstream.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
