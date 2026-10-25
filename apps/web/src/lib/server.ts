import { createClient } from "@supabase/supabase-js";
import { Redis } from "ioredis";
import { getDb, extensionSessions, eq, and, sql } from "@accessly/database";
import { AppError, hash } from "../../../../packages/database/src/service";
const shared = globalThis as unknown as { apiRedis?: Redis };
export function redis() {
  return (shared.apiRedis ??= new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  }));
}
export async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new AppError(401, "Sign in to Accessly to continue.");
  if (token.startsWith("ax_")) {
    const [session] = await getDb()
      .select()
      .from(extensionSessions)
      .where(
        and(
          eq(extensionSessions.tokenHash, hash(token)),
          sql`${extensionSessions.expiresAt}>now()`,
        ),
      );
    if (!session)
      throw new AppError(
        401,
        "Extension connection expired. Reconnect to Accessly.",
      );
    return session.ownerId;
  }
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new AppError(401, "Session expired. Sign in again.");
  return data.user.id;
}
export async function limited(key: string, limit: number) {
  const client = redis();
  const slot = `accessly:rate:${key}:${Math.floor(Date.now() / 60000)}`;
  const n = await client.incr(slot);
  if (n === 1) await client.expire(slot, 70);
  if (n > limit)
    throw new AppError(429, "Too many requests. Try again in one minute.");
}
export async function body(request: Request, max = 8_000_000) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "Request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new AppError(400, "Request must contain valid JSON.");
  }
}
