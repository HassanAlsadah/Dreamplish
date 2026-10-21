import type { Metadata } from "next";
import { CheckJobForm } from "@/components/jobs/check-job-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/dal";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.career.tabMatch };
}

export default async function CheckJobPage() {
  await requireUser();
  const { d } = await getI18n();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Breadcrumbs label={d.nav.breadcrumb} items={[{ label: d.dashboard.title, href: "/dashboard" }, { label: d.career.tabMatch }]} />
      </div>
      <h1 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">{d.career.tabMatch}</h1>
      <p className="mx-auto mt-2 max-w-xl text-center text-muted">{d.check.subtitle}</p>
      <Card className="relative mt-8 overflow-hidden p-6 sm:p-10">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-dawn)]" />
        <CheckJobForm />
      </Card>
    </div>
  );
}
