import { describe, it, expect } from "vitest";
import {
  publicAddress,
  resolveTarget,
  startProxy,
} from "../../apps/worker/src/network";
import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
describe("worker network boundaries", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "100.64.0.1",
    "192.0.2.1",
  ])("rejects nonpublic address %s", (address) =>
    expect(publicAddress(address)).toBe(false),
  );
  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "accepts public unicast address %s",
    (address) => expect(publicAddress(address)).toBe(true),
  );
  it("rejects unsupported protocols, credentials, and ports", async () => {
    for (const url of [
      "file:///etc/passwd",
      "http://user:pass@example.com",
      "https://1.1.1.1:54322",
      "http://[::1]/",
    ])
      await expect(resolveTarget(new URL(url))).rejects.toThrow();
  });
  it("permits only an exact configured fixture origin", async () => {
    expect(
      (
        await resolveTarget(
          new URL("http://127.0.0.1:4174/public"),
          "http://127.0.0.1:4174",
        )
      ).port,
    ).toBe(4174);
    await expect(
      resolveTarget(new URL("http://127.0.0.1:54321"), "http://127.0.0.1:4174"),
    ).rejects.toThrow();
  });
  it("denies actual proxied requests before they reach a private server", async () => {
    let hits = 0;
    const internal = http.createServer((_req, res) => {
      hits++;
      res.end("secret");
    });
    internal.listen(0, "127.0.0.1");
    await once(internal, "listening");
    const port = (internal.address() as AddressInfo).port;
    const proxy = await startProxy();
    try {
      const response = await new Promise<number>((resolve) =>
        http.get(
          proxy.url,
          { path: `http://127.0.0.1:${port}/private` },
          (res) => {
            res.resume();
            resolve(res.statusCode!);
          },
        ),
      );
      expect(response).toBe(403);
      expect(hits).toBe(0);
    } finally {
      await proxy.close();
      await new Promise<void>((resolve) => internal.close(() => resolve()));
    }
  });
});
