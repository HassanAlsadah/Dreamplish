import { CircleDot, Globe, Handshake, LayoutList, Mail, MessageCircle, Network, UserSearch, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmt, formatDate, type Dictionary, type Locale } from "@/lib/i18n/config";
import type { AppliedVia, Job } from "@/lib/types";

export const APPLIED_VIA_ICONS: Record<AppliedVia, LucideIcon> = {
  linkedin: Network,
  company_website: Globe,
  email: Mail,
  whatsapp: MessageCircle,
  referral: Users,
  job_board: LayoutList,
  recruiter: UserSearch,
  in_person: Handshake,
  other: CircleDot,
};

/** Job page section: where and how the user applied. */
export function AppliedViaCard({ job, d, locale }: { job: Job; d: Dictionary; locale: Locale }) {
  const via = job.applied_via ?? null;
  const Icon = via ? APPLIED_VIA_ICONS[via] : CircleDot;
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">{d.job.appliedVia}</h2>
      {via ? (
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{d.appliedVia[via]}</p>
            {job.applied_via_detail && (
              <p className="mt-0.5 break-words text-muted" dir="auto">
                {job.applied_via_detail}
              </p>
            )}
            {job.date_applied && <p className="mt-0.5 text-xs text-muted">{fmt(d.job.appliedOn, { date: formatDate(job.date_applied, locale) })}</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">{d.job.appliedViaEmpty}</p>
      )}
    </Card>
  );
}
