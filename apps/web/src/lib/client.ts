import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function supabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      throw new Error(
        "Local services are not configured. Run pnpm local:setup from the project directory.",
      );
    client = createClient(url, key);
  }
  return client;
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session) throw new Error("Sign in to continue.");
  const response = await fetch(`/api/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const json = await response.json();
  if (!response.ok)
    throw new Error(
      json.error +
        (json.details
          ? " " +
            json.details.map((d: any) => `${d.path}: ${d.message}`).join("; ")
          : ""),
    );
  return json;
}
