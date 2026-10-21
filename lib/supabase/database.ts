import type { MergeDeep } from "type-fest";
import type { InterviewQuestion, JobAnalysis, TailoredCv, TalkingPoint } from "@/lib/career/types";
import type { EmailKind } from "@/lib/email/classify";
import type { Locale } from "@/lib/i18n/config";
import type { MeteredKind } from "@/lib/rate-limit";
import type { StepKind } from "@/lib/schemas/history";
import type { StageColor, StageNameI18n } from "@/lib/stages";
import type { AppliedVia } from "@/lib/types";
import type { Database as Generated } from "./database.types";

/**
 * The database types the Supabase clients use: the generated ones (npm run db:types), with what the
 * generator can't know layered on top — values a CHECK constraint limits (it sees plain text) and
 * the shape of JSON columns the app reads directly. Read rows only; writes accept the wider types.
 * Keep each override in step with its constraint in supabase/schema.sql.
 */
export type Database = MergeDeep<
  Generated,
  {
    public: {
      Tables: {
        ai_requests: { Row: { kind: MeteredKind } };
        board_stages: { Row: { preset: "assessment" | null; color: StageColor; name_i18n: StageNameI18n | null } };
        email_connections: { Row: { provider: "outlook" | "gmail"; status: "active" | "error" } };
        email_events: {
          Row: {
            kind: EmailKind;
            confidence: "low" | "medium" | "high";
            action: "create" | "update" | "none";
            state: "pending" | "accepted" | "ignored";
            direction: "received" | "sent";
            applied_via: AppliedVia | null;
          };
        };
        interview_preps: { Row: { questions: InterviewQuestion[]; talking_points: TalkingPoint[] } };
        job_status_history: { Row: { step_kind: StepKind | null } };
        jobs: {
          Row: {
            source: "manual" | "email";
            applied_via: AppliedVia | null;
            analysis: JobAnalysis | null;
            tailored_cv: TailoredCv | null;
          };
        };
        profiles: { Row: { locale: Locale; cv_file_type: "docx" | "pdf" | "txt" | null } };
      };
    };
  }
>;

/** A table's row as the app reads it (with the overrides above). */
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
