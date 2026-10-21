"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

export function Providers({ locale, nonce, children }: { locale: Locale; nonce?: string; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </ThemeProvider>
  );
}
