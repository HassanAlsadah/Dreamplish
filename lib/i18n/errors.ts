import type { Dictionary } from "./config";

/** Resolve an error key ("required", "auth.invalidCredentials") to a message. */
export function errorText(d: Dictionary, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const [ns, name] = key.includes(".") ? key.split(".") : ["errors", key];
  const group = (d as unknown as Record<string, Record<string, string>>)[ns];
  return group?.[name] ?? d.errors.generic;
}
