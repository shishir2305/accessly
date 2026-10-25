import { it, expect } from "vitest";
import {
  applicationInput,
  safeUrl,
  extensionMessage,
} from "../../packages/contracts/src";
it("bounds permitted origins and removes URL secrets", () => {
  const app = applicationInput.parse({
    name: "Portal",
    environment: "Test",
    origin: "http://localhost:4174",
    pages: ["http://localhost:4174/public?token=secret#account"],
  });
  expect(app.pages).toEqual(["http://localhost:4174/public"]);
  expect(() =>
    applicationInput.parse({ ...app, pages: ["http://elsewhere.test/"] }),
  ).toThrow();
  expect(() => safeUrl("not a url")).toThrow();
  expect(() =>
    applicationInput.parse({
      ...app,
      origin: "http://user:password@localhost:4174",
    }),
  ).toThrow();
});
it("rejects unsupported extension messages and unsafe locators", () => {
  expect(() =>
    extensionMessage.parse({ type: "execute", code: "steal()" }),
  ).toThrow();
  expect(() =>
    extensionMessage.parse({
      type: "highlight",
      locator: 'button[onclick="secret"]',
    }),
  ).toThrow();
});
