"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/actions/preferences";
import { useI18n } from "@/lib/i18n/client";

const iconButton =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm text-topbar-fg/80 " +
  "transition hover:bg-topbar-pill hover:text-topbar-fg disabled:opacity-50";

export function ThemeToggle() {
  const { d } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className={iconButton}
      aria-label={d.nav.themeLabel}
      title={d.nav.themeLabel}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Both icons render; CSS picks one, so there's no hydration flash. */}
      <Sun className="hidden size-[18px] dark:block" />
      <Moon className="size-[18px] dark:hidden" />
    </button>
  );
}

export function LocaleToggle() {
  const { locale, d } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={iconButton}
      aria-label={d.nav.languageLabel}
      title={d.nav.languageLabel}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(locale === "ar" ? "en" : "ar");
          router.refresh();
        })
      }
    >
      <Languages className="size-[18px]" />
      {/* Icon only on phones so the top bar stays on one row; the button keeps its accessible name. */}
      <span lang={locale === "ar" ? "en" : "ar"} className="hidden sm:inline">
        {d.nav.language}
      </span>
    </button>
  );
}
