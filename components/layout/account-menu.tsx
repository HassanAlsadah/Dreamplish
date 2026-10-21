"use client";

import { LogOut, UserRound } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { logout } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { EASE_IN_CUBIC, EASE_OUT_QUINT } from "@/lib/motion";

/**
 * Avatar button at the end of the top bar; opens a small menu with the user's name, Profile and
 * Log out. Replaces the identity chip that used to sit in its own row under the top bar.
 */
export function AccountMenu({ name, email }: { name: string; email: string | null }) {
  const { d } = useI18n();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initial = name.trim().charAt(0).toUpperCase() || "•";

  // Close on outside click or Escape (focus returns to the avatar).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${d.nav.account}: ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="ms-1 flex size-9 items-center justify-center rounded-full bg-topbar-fg text-sm font-semibold text-topbar transition hover:opacity-90"
      >
        {initial}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.15, ease: EASE_OUT_QUINT } }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.98, transition: { duration: 0.11, ease: EASE_IN_CUBIC } }}
            style={{ transformOrigin: "top" }}
            className="absolute end-0 top-full z-50 mt-2 w-60 rounded-2xl border border-border bg-surface p-1.5 text-fg shadow-[var(--shadow-card)]"
          >
            <div className="px-3 py-2">
              <p className="truncate font-medium" dir="auto">
                {name}
              </p>
              {email && email !== name && (
                <p className="truncate text-xs text-muted" dir="ltr">
                  {email}
                </p>
              )}
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              <UserRound className="size-4 text-muted" />
              {d.nav.profile}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <LogOut className="size-4 text-muted" />
                {d.nav.logout}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
