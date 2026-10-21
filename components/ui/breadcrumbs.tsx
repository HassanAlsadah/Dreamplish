import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * label: text, or text with user-typed names wrapped in <bdi> (see `withNames`), so an Arabic
 * company name in an English page (or the reverse) keeps its own direction without reordering the
 * words around it. `text` is the plain version, for the hover title.
 */
export type Crumb = { label: ReactNode; text?: string; href?: string };

/** "{company} briefing" → <bdi>Company</bdi> briefing, keeping each name in its own direction. */
export function withNames(template: string, names: Record<string, string>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return key && key in names ? <bdi key={i}>{names[key]}</bdi> : part;
  });
}

/**
 * "Where am I, and how do I get back": a trail of links on the deeper pages, e.g.
 * Your applications › HungerStation › Product Operations Senior Specialist. The last item is the
 * current page. The arrows flip in Arabic; long names are cut with an ellipsis (full name on hover).
 */
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden className="shrink-0">
                  <ChevronRight className="size-3.5 rtl:rotate-180" />
                </li>
              )}
              {/* Each item takes only the room it needs (the trail stays together at the start). */}
              <li className={last ? "min-w-0" : "min-w-0 max-w-[40%] shrink-0 sm:max-w-xs"}>
                {last || !item.href ? (
                  <span aria-current={last ? "page" : undefined} className="block truncate text-fg" title={item.text}>
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="block truncate transition-colors hover:text-fg hover:underline" title={item.text}>
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
