import type { Metadata } from "next";
import { JobForm } from "@/components/jobs/job-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { createJob } from "@/lib/actions/jobs";
import { getProfile, listStages } from "@/lib/dal";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { todayIso } from "@/lib/schemas/job";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.job.newTitle };
}

export default async function NewJobPage() {
  const [{ d }, profile, stages] = await Promise.all([getI18n(), getProfile(), listStages()]);
  const firstName = profile?.name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Breadcrumbs label={d.nav.breadcrumb} items={[{ label: d.dashboard.title, href: "/dashboard" }, { label: d.nav.addJob }]} />
      </div>
      <h1 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {firstName ? fmt(d.greeting.addJob, { name: firstName }) : d.greeting.addJobNoName}
      </h1>
      <p className="mt-2 text-center text-muted">{d.job.newSubtitle}</p>
      <Card className="relative mt-8 overflow-hidden p-6 sm:p-10">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-dawn)]" />
        <JobForm action={createJob} today={todayIso()} stages={stages} />
      </Card>
    </div>
  );
}
