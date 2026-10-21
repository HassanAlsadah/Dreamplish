import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";
import { supabaseSecretKey } from "@/lib/env.server";
import type { Database } from "./database";

/**
 * Service-role client. Bypasses Row Level Security — only use it for work that
 * no single user owns (the briefing queue), never with user-supplied filters alone.
 */
export function createAdminClient() {
  const key = supabaseSecretKey();
  if (!key) throw new BriefingConfigError("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class BriefingConfigError extends Error {}
