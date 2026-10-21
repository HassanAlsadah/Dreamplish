import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";

/** Wordmark in the display serif; Arabic uses a kashida stretch like the reference design. */
export function Logo({ locale, href = "/", label = "Dreamplish" }: { locale: Locale; href?: string; label?: string }) {
  return (
    <Link href={href} className="font-wordmark text-[26px] leading-none text-topbar-fg sm:text-3xl" aria-label={label} translate="no">
      {locale === "ar" ? "دريمبلـــــــش" : "Dreamplish"}
    </Link>
  );
}
