import "server-only";

// Read lazily so pages that don't need these still work when they're missing.

/**
 * mock   — free sample data, no keys
 * tavily — Tavily web search + Gemini (free tiers) writes the brief from the results
 * gemini — Gemini with built-in Google Search grounding (needs a billing-enabled key)
 */
export type AiProvider = "mock" | "tavily" | "gemini";

export function aiProvider(): AiProvider {
  const p = process.env.AI_PROVIDER;
  return p === "gemini" || p === "tavily" ? p : "mock";
}

export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || undefined;
}

export function geminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY || undefined,
    // Flash-Lite answers in seconds on the free tier; the bigger model is the fallback.
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.8-flash",
  };
}

export function tavilyApiKey(): string | undefined {
  return process.env.TAVILY_API_KEY || undefined;
}

export function workerSecret(): string | undefined {
  return process.env.WORKER_SECRET || undefined;
}

export function briefsDailyLimit(): number {
  const n = Number(process.env.BRIEFS_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

/**
 * Briefings for the whole app per calendar month (UTC). Each briefing runs about 11–15 web searches,
 * and the search provider's quota is shared by everyone, so new briefings pause at this cap.
 */
export function briefsMonthlyLimit(): number {
  const n = Number(process.env.BRIEFS_MONTHLY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 65;
}

export function outlookConfig() {
  return {
    clientId: process.env.OUTLOOK_CLIENT_ID || undefined,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || undefined,
  };
}

/** Google OAuth client for signing in (openid, email, profile). The same client is set on Supabase's Google provider. */
export function googleSignInConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || undefined,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
  };
}

/** Google OAuth client for Gmail (gmail.readonly). Can be the same client as Google sign-in. */
export function gmailConfig() {
  return {
    clientId: process.env.GMAIL_CLIENT_ID || undefined,
    clientSecret: process.env.GMAIL_CLIENT_SECRET || undefined,
  };
}

/** 32-byte key (64 hex chars) used to encrypt mailbox refresh tokens at rest. */
export function emailTokenKey(): Buffer | undefined {
  const hex = process.env.EMAIL_TOKEN_KEY;
  return hex && /^[0-9a-f]{64}$/i.test(hex) ? Buffer.from(hex, "hex") : undefined;
}
