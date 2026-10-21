import "server-only";
import type { GroundingMetadata } from "@google/genai";
import { geminiConfig } from "@/lib/env.server";
import type { ProviderResult, ResearchInput, SourceRef } from "../types";
import { classifyProviderError, geminiClient, structureBrief } from "./structure";

/*
 * Gemini with built-in Google Search grounding (requires a billing-enabled key).
 *  1. Research with the google_search tool → prose + grounding metadata (real citations).
 *  2. structureBrief() turns that prose into JSON, citing only the numbered grounding sources.
 */

const TIMEOUT_MS = 150_000;

function researchPrompt(input: ResearchInput) {
  const cutoff = new Date(Date.parse(input.today) - 92 * 86_400_000).toISOString().slice(0, 10);
  const roles = input.roles.length ? input.roles.map((r) => `"${r}"`).join(", ") : "(none)";
  return `Today is ${input.today}. Research the company "${input.companyName}"${
    input.website ? ` (official website: ${input.website})` : ""
  } using Google Search.

Rules:
- Only state facts found in the search results. Never guess or rely on memory.
- If you cannot find information for a section, write exactly "NOT FOUND" under it.
- Do not use LinkedIn or Glassdoor as sources.
- Prefer the company's official pages, its careers/job pages, and reputable news outlets.

## NEWS
Up to 6 notable news items published after ${cutoff}, each with its date (YYYY-MM-DD) and a one- or two-sentence summary.

## PROJECTS
Up to 6 main products, services or projects.

## VALUES
Up to 6 values or culture points as described on the company's own pages.

## SKILLS
Up to 12 skills or tools the company commonly asks for in its public job postings.

## SALARY
For each of these roles: ${roles}. A salary range from public sources, with currency, period and location, or "NOT FOUND".`;
}

/** Insert [S#] markers after each grounded segment so the structuring step knows what is cited. */
function annotate(text: string, meta: GroundingMetadata | undefined) {
  let annotated = text;
  const supports = [...(meta?.groundingSupports ?? [])]
    .filter((s) => s.segment?.text && s.groundingChunkIndices?.length)
    .sort((a, b) => b.segment!.text!.length - a.segment!.text!.length);
  for (const s of supports) {
    const seg = s.segment!.text!;
    const marker = ` [${s.groundingChunkIndices!.map((i) => `S${i + 1}`).join(", ")}]`;
    const at = annotated.indexOf(seg);
    if (at === -1) continue;
    const end = at + seg.length;
    if (annotated.startsWith(" [S", end)) continue;
    annotated = annotated.slice(0, end) + marker + annotated.slice(end);
  }
  return annotated;
}

const GROUNDING_HOST = "vertexaisearch.cloud.google.com";

/** Grounding URIs are Google redirect links; resolve them to the real page when possible. */
async function resolveSource(uri: string, title: string | undefined): Promise<SourceRef> {
  try {
    // Only Google's own redirect host is fetched (the URI comes from model output).
    const parsed = new URL(uri);
    if (parsed.protocol === "https:" && parsed.hostname === GROUNDING_HOST && parsed.pathname.includes("grounding-api-redirect")) {
      const res = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(6000) });
      const location = res.headers.get("location");
      if (location && /^https?:\/\//.test(location)) return { url: location, title: title || new URL(location).hostname };
    }
  } catch {
    // fall back to the redirect link, which still opens the source
  }
  return { url: uri, title: title || "source" };
}

export async function geminiResearch(input: ResearchInput): Promise<ProviderResult> {
  const ai = geminiClient();
  let text: string;
  let meta: GroundingMetadata | undefined;
  try {
    const research = await ai.models.generateContent({
      model: geminiConfig().model,
      contents: researchPrompt(input),
      config: { tools: [{ googleSearch: {} }], temperature: 0.2, abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
    });
    text = research.text ?? "";
    meta = research.candidates?.[0]?.groundingMetadata;
  } catch (e) {
    classifyProviderError(e);
  }

  const chunks = meta?.groundingChunks ?? [];
  const searchSuggestions = meta?.searchEntryPoint?.renderedContent ?? null;
  if (!text || chunks.length === 0) {
    return { provider: "gemini", news: [], projects: [], values: [], skills: [], salary: [], searchSuggestions };
  }

  const sources = await Promise.all(chunks.map((c) => resolveSource(c.web?.uri ?? "", c.web?.title)));
  const sourceList = sources.map((s, i) => `S${i + 1}: ${s.title}`).join("\n");

  return structureBrief({
    provider: "gemini",
    task: `Convert these research notes about "${input.companyName}" into the briefing JSON. Only statements carrying [S#] markers may be used.`,
    material: `Sources:\n${sourceList}\n\nResearch notes:\n${annotate(text, meta)}`,
    sources,
    searchSuggestions,
  });
}
