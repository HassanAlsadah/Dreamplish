"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; match?: (path: string) => boolean };

/** Segmented control from the reference design. */
export function NavPills({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex rounded-2xl bg-topbar-pill p-1.5">
      {items.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 rounded-xl px-4 py-2 text-center text-[15px] whitespace-nowrap transition sm:px-6",
              active ? "bg-topbar-pill-active font-medium text-topbar-fg" : "text-topbar-fg/60 hover:text-topbar-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
