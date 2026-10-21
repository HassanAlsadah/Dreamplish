import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/config";

/** Every page: links to the Privacy Policy and Terms of Use. */
export function SiteFooter({ d }: { d: Dictionary }) {
  return (
    <footer className="border-t border-border px-4 py-6 text-sm text-muted sm:px-6 lg:px-8">
      <nav aria-label={d.legal.footerNav} className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span translate="no">© {new Date().getFullYear()} Dreamplish</span>
        <Link href="/privacy" className="hover:text-fg hover:underline">
          {d.legal.privacy}
        </Link>
        <Link href="/terms" className="hover:text-fg hover:underline">
          {d.legal.terms}
        </Link>
      </nav>
    </footer>
  );
}
