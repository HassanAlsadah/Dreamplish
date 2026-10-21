import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/career/print-toolbar";
import { getCareerData } from "@/lib/career/service";
import { CvDocument, type Template } from "@/components/career/cv-document";
import { getJob, getProfile, requireUser } from "@/lib/dal";

async function load(jobId: string) {
  await requireUser();
  const [job, profile] = await Promise.all([getJob(jobId), getProfile()]);
  if (!job) return null;
  const { tailored } = await getCareerData(job.id);
  if (!tailored) return null;
  return { job, profile, tailored };
}

export async function generateMetadata({ params }: PageProps<"/cv/[jobId]">): Promise<Metadata> {
  const data = await load((await params).jobId);
  // Browsers use the page title as the default PDF file name.
  const who = data?.profile?.name?.trim() || "CV";
  return { title: { absolute: data ? `${who} - ${data.job.title} - ${data.job.company.name}` : "CV" } };
}

export default async function CvPrintPage({ params, searchParams }: PageProps<"/cv/[jobId]">) {
  const data = await load((await params).jobId);
  const requested = (await searchParams).template;
  const template: Template = requested === "modern" || requested === "compact" ? requested : "classic";
  if (!data) notFound();

  return (
    <div className="min-h-full bg-neutral-200 py-8 print:bg-white print:py-0">
      <PrintToolbar backHref={`/jobs/${data.job.id}?tab=match`} jobId={data.job.id} template={template} />
      <CvDocument text={data.tailored.text} template={template} />
    </div>
  );
}
