import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getI18n } from "@/lib/i18n/server";
import { LEGAL, LEGAL_DOCS } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: LEGAL_DOCS.privacy[locale].title };
}

export default async function Page() {
  const { locale, d } = await getI18n();
  return <LegalPage doc={LEGAL_DOCS.privacy[locale]} updated={LEGAL.updated} updatedLabel={d.legal.updated} locale={locale} />;
}
