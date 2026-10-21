import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";
import Link from "next/link";
import { BriefingPanel } from "@/components/briefing/briefing-panel";
import { Breadcrumbs, withNames } from "@/components/ui/breadcrumbs";
import { StatusBadge } from "@/components/jobs/status-dot";
import { getBriefView } from "@/lib/briefing/service";
import { requireUser } from "@/lib/dal";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/types";
import { isUuid } from "@/lib/schemas/common";

async function getCompany(id: string) {
  await requireUser();
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  // RLS only returns companies linked to one of the user's jobs.
  const { data } = await supabase
    .from("companies")
    .select("id, name, website, jobs(id, title, status)")
    .eq("id", id)
    .maybeSingle();
  return data as { id: string; name: string; website: string | null; jobs: { id: string; title: string; status: JobStatus }[] } | null;
}

export async function generateMetadata({ params }: PageProps<"/companies/[id]">): Promise<Metadata> {
  const company = await getCompany((await params).id);
  return { title: company?.name };
}

export default async function CompanyPage({ params, searchParams }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  const [{ d }, company] = await Promise.all([getI18n(), getCompany(id)]);
  if (!company) notFound();
  const brief = await getBriefView(company.id);
  // Came from one of the user's jobs here: show that job in the trail so it's one click back.
  const from = (await searchParams).job;
  const fromJob = company.jobs.find((j) => j.id === from);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={d.nav.breadcrumb}
        items={[
          { label: d.dashboard.title, href: "/dashboard" },
          // Same as the job page ("Company – Role"), then a plain "Company briefing" label, so an
          // Arabic name is never glued to an English word (or the reverse).
          ...(fromJob
            ? [
                {
                  label: withNames("{company} – {role}", { company: company.name, role: fromJob.title }),
                  text: `${company.name} – ${fromJob.title}`,
                  href: `/jobs/${fromJob.id}`,
                },
                { label: d.brief.title },
              ]
            : [{ label: <bdi>{company.name}</bdi>, text: company.name }]),
        ]}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted">{d.brief.title}</p>
          <h1 className="mt-1 font-display text-3xl font-bold break-words sm:text-4xl">{company.name}</h1>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="mt-2 inline-flex items-center gap-2 text-sm text-accent hover:underline"
            >
              <Globe className="size-4" />
              {company.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
        {company.jobs.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">{d.brief.yourJobs}</p>
            <div className="flex flex-wrap gap-2">
              {company.jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
                >
                  {job.title}
                  <StatusBadge status={job.status} label={d.status[job.status]} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <BriefingPanel
        companyId={company.id}
        companyName={company.name}
        companyWebsite={company.website}
        initial={brief.view}
        initialError={brief.error}
      />
    </div>
  );
}
