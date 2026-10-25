import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./errors";
// Local key custody uses owner-only .env.local; hosted KMS is an open deployment decision.
function keys() {
  const ring = process.env.JOURNEY_SECRET_KEYS;
  const active = process.env.JOURNEY_SECRET_KEY_ID;
  if (!ring || !active)
    throw new AppError(
      503,
      "Journey secret keys are not configured. Run local:setup or configure a server key ring.",
    );
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(ring);
  } catch {
    throw new AppError(503, "Journey key ring is invalid.");
  }
  return { parsed, active };
}
function key(id: string) {
  const value = keys().parsed[id];
  const bytes = Buffer.from(value ?? "", "base64");
  if (bytes.length !== 32)
    throw new AppError(
      503,
      "Journey encryption key is unavailable. Restore the configured key version.",
    );
  return bytes;
}
export function seal(value: unknown, aad: string) {
  const { active } = keys();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(active), iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    keyId: active,
    sealed: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64",
    ),
  };
}
export function unseal(sealed: string, keyId: string, aad: string): unknown {
  const bytes = Buffer.from(sealed, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(keyId),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export function identityAad(v: {
  id: string;
  workspaceId: string;
  applicationId: string;
  environmentId: string;
  role: string;
}) {
  return [v.id, v.workspaceId, v.applicationId, v.environmentId, v.role].join(
    ":",
  );
}
