import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { identity, signIn } from "./helpers";
test("account creation, application setup, keyboard navigation, and responsive dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const email = `signup-${crypto.randomUUID()}@accessly.test`;
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-only-Account-8274");
  await page
    .getByRole("button", { name: "Create account →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workspace overview" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Control+Home");
  await page.goto("/applications/new");
  await page
    .getByLabel("Application name", { exact: true })
    .fill("Local customer portal");
  await page.getByLabel("Permitted origin").fill("http://127.0.0.1:4174");
  await page
    .getByLabel("Saved public page URLs", { exact: false })
    .fill("http://127.0.0.1:4174/public?token=should-be-removed");
  await page.getByLabel("I am authorized").check();
  await page
    .getByRole("button", { name: "Create application", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your applications" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Local customer portal" }),
  ).toBeVisible();
  for (const route of [
    "/",
    "/applications",
    "/applications/new",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      axe.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      route,
    ).toEqual([]);
  }
  await page.goto("/");
  await page.setViewportSize({ width: 1440, height: 1000 });
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/phase1-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Assessments", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.screenshot({
    path: "artifacts/phase1-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Workspace overview" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
test("recovery request and denied result have useful recovery states", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill("nobody@accessly.test");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  const user = await identity();
  await signIn(page, user);
  await page.goto(`/runs/${crypto.randomUUID()}`);
  await expect(
    page.getByRole("alert").filter({ hasText: "Run is unavailable" }),
  ).toContainText("unavailable");
  await expect(
    page.getByRole("heading", { name: "Assessment unavailable" }),
  ).toBeVisible();
});

test("a real Supabase recovery link permits changing the password and rejects the old password", async ({
  page,
}) => {
  const user = await identity();
  const { data, error } = await user.admin.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
    options: { redirectTo: "http://127.0.0.1:3000/reset-password" },
  });
  if (error) throw error;
  await page.goto(data.properties.action_link);
  await expect(
    page.getByRole("heading", { name: "Set a new password" }),
  ).toBeVisible();
  await page
    .getByLabel("New password", { exact: true })
    .fill("Changed-Local-Password-9241");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const headers = {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    "Content-Type": "application/json",
  };
  const oldLogin = await page.request.post(
    `${authUrl}/auth/v1/token?grant_type=password`,
    { headers, data: { email: user.email, password: user.password } },
  );
  expect(oldLogin.ok()).toBe(false);
  const newLogin = await page.request.post(
    `${authUrl}/auth/v1/token?grant_type=password`,
    {
      headers,
      data: { email: user.email, password: "Changed-Local-Password-9241" },
    },
  );
  expect(newLogin.ok()).toBe(true);
});
