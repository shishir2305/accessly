import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { build } from "esbuild";
import { scanSchema } from "../../packages/contracts/src";
let browser: Browser, source: string;
beforeAll(async () => {
  browser = await chromium.launch();
  const result = await build({
    entryPoints: ["apps/extension/src/injected.ts"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
  });
  source = result.outputFiles![0].text;
});
afterAll(async () => {
  await browser?.close();
});
async function scan(
  body: string,
  exclusions: string[] = [],
  target?: { rule: string; locator: string },
) {
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main><h1>Fixture</h1>${body}</main></body></html>`,
  );
  await page.addScriptTag({ content: source });
  const result = await page.evaluate(
    async ({ excludeSelectors, target }) =>
      (window as any).__accesslyScan({
        clientScanId: "b58bca32-fc04-48bb-9865-96f228474881",
        applicationId: "b58bca32-fc04-48bb-9865-96f228474882",
        environmentId: "b58bca32-fc04-48bb-9865-96f228474883",
        mode: "extension",
        excludeSelectors,
        target,
        context: {
          url: "http://127.0.0.1:4174/protected?token=secret#private",
          title: "Page title omitted",
          state: "Protected account",
          role: "customer",
          preconditions: "Signed in with a controlled test identity",
          authentication: "user-confirmed-signed-in",
          viewport: { width: 1280, height: 720, deviceScale: 1 },
          appVersion: "test",
        },
      }),
    { excludeSelectors: exclusions, target },
  );
  await page.close();
  return scanSchema.parse(result);
}
describe("shared scanner correctness and minimization", () => {
  it("finds a known failure without collecting page text, HTML, input values, or URL secrets", async () => {
    const result = await scan(
      '<button></button><input aria-label="Secret" type="password" value="fixture-secret-never-upload"><p>private-customer-name</p>',
    );
    expect(
      result.checks.find(
        (c) => c.rule === "button-name" && c.outcome === "violation",
      ),
    ).toBeTruthy();
    const payload = JSON.stringify(result);
    expect(payload).not.toContain("fixture-secret-never-upload");
    expect(payload).not.toContain("private-customer-name");
    expect(payload).not.toContain("token=secret");
    expect(result.context.url).toBe("http://127.0.0.1:4174/protected");
    expect(
      result.checks
        .flatMap((c) => c.elements)
        .every((el) => !el.locator.includes("#")),
    ).toBe(true);
  });
  it("does not invent button-name failures for a named button", async () => {
    const result = await scan("<button>Save account</button>");
    expect(
      result.checks.find(
        (c) => c.rule === "button-name" && c.outcome === "violation",
      ),
    ).toBeUndefined();
    expect(
      result.checks.find(
        (c) => c.rule === "button-name" && c.outcome === "pass",
      ),
    ).toBeTruthy();
    expect(result.limitations.join(" ")).toContain("Human review");
  });
  it("honors scan exclusions", async () => {
    const result = await scan(
      '<div class="private"><button></button></div><button>Save</button>',
      [".private"],
    );
    expect(
      result.checks.find(
        (c) => c.rule === "button-name" && c.outcome === "violation",
      ),
    ).toBeUndefined();
    expect(result.exclusions).toEqual([".private"]);
  });
  it("reports inaccessible frame scope separately from passes", async () => {
    const result = await scan(
      '<button>Save</button><iframe title="Embedded" srcdoc="<button></button>"></iframe>',
    );
    expect(result.limitations.join(" ")).toContain("frame(s) excluded");
    expect(
      result.checks.find(
        (c) => c.rule === "button-name" && c.outcome === "violation",
      ),
    ).toBeUndefined();
  });
  it("rejects an invalid exclusion instead of silently collecting it", async () => {
    await expect(scan("<button></button>", ["???"])).rejects.toThrow();
  });
});

it("records a pass only when the original target actually receives the rule check", async () => {
  const target = {
    rule: "button-name",
    locator: "html > body > main > button",
  };
  const passed = await scan("<button>Save account</button>", [], target);
  expect(passed.targetObservation?.outcome).toBe("pass");
  expect(passed.targetObservation?.visible).toBe(true);
  const missing = await scan('<a href="/">Account</a>', [], target);
  expect(missing.targetObservation?.present).toBe(false);
  expect(missing.targetObservation?.outcome).not.toBe("pass");
  const hidden = await scan("<button hidden>Save account</button>", [], target);
  expect(hidden.targetObservation?.visible).toBe(false);
  expect(hidden.targetObservation?.outcome).not.toBe("pass");
  const excluded = await scan(
    "<button>Save account</button>",
    ["button"],
    target,
  );
  expect(excluded.targetObservation?.outcome).not.toBe("pass");
});
