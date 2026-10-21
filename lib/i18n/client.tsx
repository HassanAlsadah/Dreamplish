"use client";

import { createContext, use, type ReactNode } from "react";
import { getDictionary, type Locale } from "./config";

const LocaleContext = createContext<Locale | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useI18n() {
  const locale = use(LocaleContext);
  if (!locale) throw new Error("useI18n must be used within I18nProvider");
  return { locale, d: getDictionary(locale) };
}
