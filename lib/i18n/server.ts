import "server-only";
import { cookies, headers } from "next/headers";
import { defaultLocale, getDictionary, isLocale, LOCALE_COOKIE, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  const preferred = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return isLocale(preferred) ? preferred : defaultLocale;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, d: getDictionary(locale) };
}
