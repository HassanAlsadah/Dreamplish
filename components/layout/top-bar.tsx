import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { Logo } from "./logo";
import { LocaleToggle, ThemeToggle } from "./toggles";

export function TopBar({
  locale,
  logoHref,
  logoLabel,
  nav,
  action,
  account,
}: {
  locale: Locale;
  logoHref?: string;
  /** Accessible name for the logo link, e.g. "Dreamplish — Dashboard" when it's the way home. */
  logoLabel?: string;
  nav?: ReactNode;
  /** Main action at the end edge (signed in: Add job). */
  action?: ReactNode;
  account?: ReactNode;
}) {
  return (
    <header className="topbar border-b border-border bg-topbar text-topbar-fg dark:border-transparent">
      {/* Full width: logo at the start edge, toggles at the end edge, the menu centred between them. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8 md:grid md:grid-cols-[1fr_auto_1fr]">
        <div className="md:col-start-1 md:row-start-1 md:justify-self-start">
          <Logo locale={locale} href={logoHref} label={logoLabel} />
        </div>
        <div className="ms-auto flex items-center gap-1 md:col-start-3 md:row-start-1 md:ms-0 md:justify-self-end">
          {action}
          <LocaleToggle />
          <ThemeToggle />
          {account}
        </div>
        {nav && <div className="w-full md:col-start-2 md:row-start-1 md:w-auto">{nav}</div>}
      </div>
    </header>
  );
}
