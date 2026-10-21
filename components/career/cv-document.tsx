import { FitOnePage } from "@/components/career/fit-one-page";
import {
  hasArabic,
  parseCv,
  splitMeta,
  splitTitle,
  titleCase,
  toSections,
  type CvBlock,
  type CvEntry,
  type CvSection,
} from "@/lib/career/cv-format";

export type Template = "classic" | "modern" | "compact";

/** Per-layout look. Sizes are in em so the whole CV can shrink together to fit one page. */
const LOOK: Record<Template, { base: number; rule: string; heading: string; marginMm: number }> = {
  classic: { base: 10.5, rule: "border-neutral-900", heading: "text-neutral-900", marginMm: 14 },
  modern: { base: 10.5, rule: "border-[#3b8574]", heading: "text-[#2f6f61]", marginMm: 14 },
  compact: { base: 9.5, rule: "border-neutral-700", heading: "text-neutral-900", marginMm: 11 },
};

function Lines({ blocks }: { blocks: CvBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.type === "bullet" ? (
          <p key={i} className="relative ps-[1.1em] leading-snug">
            <span aria-hidden className="absolute start-[0.25em]">•</span>
            {b.text}
          </p>
        ) : "text" in b ? (
          <p key={i} className={b.type === "meta" ? "text-end leading-snug" : "leading-snug"}>
            {b.text}
          </p>
        ) : null,
      )}
    </>
  );
}

/** Bold title, italic organisation after the comma, dates and place on the right. */
function Entry({ entry }: { entry: CvEntry }) {
  const [main, sub] = splitTitle(entry.title.text);
  const { dates, places } = splitMeta(entry.title.meta);
  return (
    <div className="mt-[0.55em] grid break-inside-avoid grid-cols-[minmax(0,1fr)_auto] gap-x-[1.5em] first:mt-0">
      <div className="min-w-0">
        <p className="leading-snug">
          <span className="font-bold">
            {main}
            {sub ? "," : ""}
          </span>
          {sub && <em className="italic"> {sub}</em>}
        </p>
        <Lines blocks={entry.body} />
      </div>
      {(dates.length > 0 || places.length > 0) && (
        <div className="text-end leading-snug whitespace-nowrap">
          {dates.map((d) => (
            <p key={d}>{d}</p>
          ))}
          {places.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Label + bullets (e.g. Skills: Technologies / Soft Skills), shown in two columns. */
function Groups({ entries }: { entries: CvEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-[2em] gap-y-[0.5em]">
      {entries.map((e, i) => (
        <div key={i} className="break-inside-avoid">
          <p className="leading-snug font-bold">{e.title.text}</p>
          <Lines blocks={e.body} />
        </div>
      ))}
    </div>
  );
}

function Section({ section, template }: { section: Extract<CvSection, { kind: "section" }>; template: Template }) {
  const look = LOOK[template];
  return (
    <section style={{ marginTop: "calc(1em + var(--cv-extra, 0px))" }}>
      <h2 className={`mb-[0.45em] break-after-avoid border-b-2 pb-[0.1em] text-[1.12em] font-bold ${look.rule} ${look.heading}`}>
        {titleCase(section.heading)}
      </h2>
      <Lines blocks={section.intro} />
      {section.layout === "groups" ? (
        <Groups entries={section.entries} />
      ) : (
        section.entries.map((e, i) => <Entry key={i} entry={e} />)
      )}
    </section>
  );
}

/** A4 CV sheet, same on screen and when printed; always fits on one page. */
export function CvDocument({ text, template }: { text: string; template: Template }) {
  const sections = toSections(parseCv(text));
  const top = sections[0].kind === "top" ? sections[0] : null;
  const look = LOOK[template];
  const dir = hasArabic(text) ? "rtl" : "ltr";

  return (
    <article
      dir={dir}
      className="mx-auto box-border min-h-[297mm] w-[210mm] max-w-full bg-white font-sans text-neutral-900 shadow-lg print:min-h-0 print:shadow-none"
      style={{ colorScheme: "light", padding: `${look.marginMm}mm ${look.marginMm + 2}mm` }}
    >
      {/* Fill one A4 page (as Chrome/Edge print it: no browser margins), with a small safety margin. */}
      <FitOnePage pageHeightMm={297 - 2 * look.marginMm - 5}>
        {top && (
          <header className="text-center">
            {top.name && <h1 className="text-[2.2em] leading-tight font-bold">{top.name}</h1>}
            {top.contact.length > 0 && (
              <p className="mt-[0.3em] text-[0.98em]">
                {top.contact.map((c, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-[0.6em] text-neutral-500">|</span>}
                    {c}
                  </span>
                ))}
              </p>
            )}
          </header>
        )}
        {sections.map((s, i) => (s.kind === "section" ? <Section key={i} section={s} template={template} /> : null))}
      </FitOnePage>
    </article>
  );
}
