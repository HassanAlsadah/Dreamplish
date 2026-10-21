import en, { type Dictionary } from "./dictionaries/en";
import ar from "./dictionaries/ar";

export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "dreamplish-locale";

const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function getDir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

// Gregorian calendar + Latin digits for Arabic, matching the design.
export function intlTag(locale: Locale): string {
  return locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-US";
}

/** Replace {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

/** Format a YYYY-MM-DD or ISO date for display. */
export function formatDate(value: string, locale: Locale): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export type { Dictionary };
