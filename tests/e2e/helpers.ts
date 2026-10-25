import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
export const origin = "http://127.0.0.1:3000";
export async function identity() {
  const email = `phase1-${crypto.randomUUID()}@accessly.test`,
    password = randomBytes(20).toString("base64url");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: login, error: loginError } =
    await client.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  return {
    id: data.user!.id,
    email,
    password,
    token: login.session!.access_token,
    admin,
  };
}
export async function call(
  request: APIRequestContext,
  token: string,
  path: string,
  method = "GET",
  data?: unknown,
) {
  return request.fetch(`${origin}/api/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}
export async function app(request: APIRequestContext, token: string) {
  const response = await call(request, token, "applications", "POST", {
    name: "Controlled customer portal",
    environment: "Local test",
    origin: "http://127.0.0.1:4174",
    pages: ["http://127.0.0.1:4174/public"],
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
export async function signIn(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workspace overview" }),
  ).toBeVisible();
}
export async function waitRun(
  request: APIRequestContext,
  token: string,
  id: string,
) {
  let result: any;
  await expect
    .poll(
      async () => {
        const response = await call(request, token, `runs/${id}`);
        result = await response.json();
        return result.status;
      },
      { timeout: 80000, intervals: [500, 1000, 2000] },
    )
    .toMatch(/completed|partial|failed|cancelled/);
  return result;
}
