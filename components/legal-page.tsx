import type { LegalDoc } from "@/lib/legal";
import { formatDate, type Locale } from "@/lib/i18n/config";

/** A legal document (Privacy Policy, Terms of Use) as a readable page. */
export function LegalPage({ doc, updated, updatedLabel, locale }: { doc: LegalDoc; updated: string; updatedLabel: string; locale: Locale }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {updatedLabel} {formatDate(updated, locale)}
      </p>
      <p className="mt-6 text-lg leading-relaxed text-pretty">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.body.map((part, i) =>
            typeof part === "string" ? (
              <p key={i} className="mt-3 leading-relaxed text-pretty text-fg/90">
                {part}
              </p>
            ) : (
              <ul key={i} className="mt-3 flex list-disc flex-col gap-2 ps-5 leading-relaxed text-fg/90 marker:text-muted">
                {part.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
