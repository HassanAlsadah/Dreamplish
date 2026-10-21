import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { geminiConfig } from "@/lib/env.server";

export type AiErrorCode = "not_configured" | "rate_limited" | "timeout" | "invalid_output" | "provider_error";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 150_000;
const FIRST_TRY_MS = 75_000;
const OVERLOADED = /"code":\s*(429|503)|high demand|unavailable|overloaded/i;

export function classifyAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timeout|timed out/i.test(message)) return new AiError("timeout", message);
  if (OVERLOADED.test(message) || /quota|rate/i.test(message)) return new AiError("rate_limited", message);
  if (/API key|"code":\s*(401|403)|permission/i.test(message)) return new AiError("not_configured", message);
  return new AiError("provider_error", message);
}

/**
 * JSON-schema-constrained Gemini call (no tools), validated with Zod.
 * Falls back to the lighter model when the main one is overloaded — common on the free tier.
 */
export async function generateStructured<T>({
  prompt,
  jsonSchema,
  schema,
  temperature = 0.2,
}: {
  prompt: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const { apiKey, model, fallbackModel } = geminiConfig();
  if (!apiKey) throw new AiError("not_configured", "GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });
  const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];

  let lastError: unknown;
  for (const m of models) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          temperature,
          // The first model gets less time so a stalled request still leaves room for the fallback.
          abortSignal: AbortSignal.timeout(m === models[0] && models.length > 1 ? FIRST_TRY_MS : TIMEOUT_MS),
        },
      });
      try {
        return schema.parse(JSON.parse(res.text ?? ""));
      } catch (e) {
        throw new AiError("invalid_output", e instanceof Error ? e.message : "unparseable JSON");
      }
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!OVERLOADED.test(msg) && !/abort|timeout|timed out/i.test(msg)) break;
    }
  }
  throw classifyAiError(lastError);
}
