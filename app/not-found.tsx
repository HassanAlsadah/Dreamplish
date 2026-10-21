import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { d } = await getI18n();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-display text-7xl font-bold text-muted">404</p>
      <h1 className="font-display text-3xl font-bold">{d.errors.notFoundTitle}</h1>
      <p className="text-muted">{d.errors.notFoundBody}</p>
      <ButtonLink href="/" className="mt-2">
        {d.errors.goHome}
      </ButtonLink>
    </main>
  );
}
