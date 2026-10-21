import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";

export default async function JobNotFound() {
  const { d } = await getI18n();
  return (
    <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 p-10 text-center">
      <h1 className="font-display text-2xl font-bold">{d.errors.notFoundTitle}</h1>
      <p className="text-muted">{d.job.notFound}</p>
      <ButtonLink href="/dashboard">{d.job.back}</ButtonLink>
    </Card>
  );
}
