import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { emailTokenKey } from "@/lib/env.server";

/** AES-256-GCM for mailbox refresh tokens. Format: iv.tag.ciphertext (base64url). */
function key() {
  const k = emailTokenKey();
  if (!k) throw new Error("EMAIL_TOKEN_KEY is missing or not 64 hex characters");
  return k;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(encoded: string): string {
  const [iv, tag, data] = encoded.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
