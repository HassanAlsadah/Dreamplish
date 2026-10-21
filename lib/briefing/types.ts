import { z } from "zod";

export const sourceRefSchema = z.object({ url: z.string(), title: z.string() });

export const briefItemSchema = z.object({
  /** Short heading, e.g. a product name (projects only). */
  name: z.string().nullable().default(null),
  text: z.string(),
  sources: z.array(sourceRefSchema).min(1),
  published_at: z.string().nullable().default(null),
});

export const sectionSchema = z.object({
  status: z.enum(["found", "not_found"]),
  items: z.array(briefItemSchema),
});

export const confidenceSchema = z.enum(["low", "medium", "high"]);

export const salaryEntrySchema = z.object({
  role: z.string(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  currency: z.string(),
  period: z.enum(["year", "month", "hour"]),
  note: z.string().default(""),
  sources: z.array(sourceRefSchema).min(1),
  confidence: confidenceSchema,
});

export const WATCHOUT_CATEGORIES = ["layoffs", "legal", "financial", "workplace", "leadership", "reputation"] as const;
export const WATCHOUT_STATUSES = ["reported", "alleged", "confirmed"] as const;

export const watchoutItemSchema = z.object({
  category: z.enum(WATCHOUT_CATEGORIES),
  status: z.enum(WATCHOUT_STATUSES),
  text: z.string(),
  /** Verbatim sentence from the source. */
  quote: z.string(),
  published_at: z.string(),
  interview_tip: z.string().default(""),
  sources: z.array(sourceRefSchema).min(1),
});
export const watchoutsSchema = z.object({
  status: z.enum(["found", "not_found"]),
  items: z.array(watchoutItemSchema),
});
export type WatchoutItem = z.infer<typeof watchoutItemSchema>;
export type Watchouts = z.infer<typeof watchoutsSchema>;

export const roleInsightsSchema = z.object({
  duties: z.array(z.object({ role: z.string(), text: z.string(), quote: z.string(), sources: z.array(sourceRefSchema).min(1) })),
  team_work: z.array(
    z.object({ text: z.string(), quote: z.string(), published_at: z.string().nullable(), sources: z.array(sourceRefSchema).min(1) }),
  ),
  tools: z.array(z.object({ text: z.string(), sources: z.array(sourceRefSchema).min(1) })),
});
export type RoleInsights = z.infer<typeof roleInsightsSchema>;

export type SourceRef = z.infer<typeof sourceRefSchema>;
export type BriefItem = z.infer<typeof briefItemSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SalaryEntry = z.infer<typeof salaryEntrySchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type BriefStatus = "pending" | "generating" | "ready" | "failed";

export const SECTION_KEYS = ["news", "projects", "values", "skills"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Error codes stored in company_briefs.error and returned by the API. */
export type BriefErrorCode =
  | "not_configured"
  | "rate_limited"
  | "provider_error"
  | "timeout"
  | "invalid_output";

/** What the browser receives. Salary is filtered to the viewer's own roles. */
export type BriefView = {
  companyId: string;
  status: BriefStatus;
  provider: string | null;
  generatedAt: string | null;
  requestedAt: string;
  error: BriefErrorCode | null;
  sections: Record<SectionKey, Section> | null;
  salary: SalaryEntry[];
  /** Roles the viewer applied for at this company with no salary entry yet. */
  salaryMissingRoles: string[];
  searchSuggestions: string | null;
  canRefreshAt: string | null;
  links: BriefLinks;
  summary: BriefItem | null;
  /** Null for briefs generated before this section existed (refresh to add it). */
  watchouts: Watchouts | null;
  /** Duties filtered to the viewer's own roles. Null for briefs made before this section existed. */
  roleInsights: RoleInsights | null;
  /** The viewer's job titles at this company (for the "find people in this role" link). */
  viewerRoles: string[];
};

export type BriefLinks = { website: string | null; linkedin: string | null };

/** Raw output from a provider before validation and source checks. */
export type RawItem = { name?: string | null; text: string; sources: SourceRef[]; publishedAt?: string | null };
export type RawSalary = Omit<SalaryEntry, "note"> & { note?: string };
export type ProviderResult = {
  provider: string;
  news: RawItem[];
  projects: RawItem[];
  values: RawItem[];
  skills: RawItem[];
  salary: RawSalary[];
  searchSuggestions: string | null;
  links?: Partial<BriefLinks>;
  summary?: RawItem | null;
  watchouts?: RawWatchout[];
  roleInsights?: {
    duties: Array<{ role: string; text: string; quote: string; sources: SourceRef[] }>;
    team_work: Array<{ text: string; quote: string; published_at: string | null; sources: SourceRef[] }>;
    tools: Array<{ text: string; sources: SourceRef[] }>;
  };
};

export type RawWatchout = Omit<WatchoutItem, "sources" | "interview_tip"> & { interview_tip?: string; sources: SourceRef[] };

export type ResearchInput = {
  companyName: string;
  website: string | null;
  roles: string[];
  today: string;
};

export const BRIEF_TTL_DAYS = 7;
export const REFRESH_COOLDOWN_MINUTES = 60;
