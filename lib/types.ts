export const JOB_STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** How the user applied: the channel (with a short free-text detail stored next to it). */
export const APPLIED_VIA = ["linkedin", "company_website", "email", "whatsapp", "referral", "job_board", "recruiter", "in_person", "other"] as const;
export type AppliedVia = (typeof APPLIED_VIA)[number];

export type Company = {
  id: string;
  name: string;
  website: string | null;
};

export type Job = {
  id: string;
  title: string;
  link: string | null;
  status: JobStatus;
  date_applied: string | null;
  notes: string | null;
  job_description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  company: Company;
  /** Board column (null = the core column of `status`). */
  stage_id: string | null;
  /** Assessment / interview type from an email, e.g. "Technical interview" (shown in small text). */
  stage_detail: string | null;
  /** How the user applied, and a short detail like "WhatsApp to Ahmed, HR". */
  applied_via: AppliedVia | null;
  applied_via_detail: string | null;
};

export type Profile = {
  id: string;
  name: string | null;
  cv_text: string | null;
  cv_file_path?: string | null;
  cv_file_name?: string | null;
  cv_file_type?: "docx" | "pdf" | "txt" | null;
};

/** Result returned by every Server Action used with useActionState. */
export type ActionState = {
  ok: boolean;
  /** Translation key under `errors` or a namespaced key like `auth.invalidCredentials`. */
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  message?: string;
};
