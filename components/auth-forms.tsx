"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client";

/** A full page navigation: the app's own Google sign-in (/api/auth/google), then back to the dashboard. */
function GoogleButton() {
  const { d } = useI18n();
  const [pending, setPending] = useState(false);
  return (
    <a
      href="/api/auth/google"
      onClick={() => setPending(true)}
      aria-disabled={pending || undefined}
      className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface text-[15px] font-medium transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:pointer-events-none aria-disabled:opacity-50"
    >
      <svg aria-hidden viewBox="0 0 48 48" className="size-5">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {pending ? d.common.loading : d.auth.continueWithGoogle}
    </a>
  );
}

/** "By continuing you agree to the Terms of Use and the Privacy Policy", with both linked. */
function Agreement() {
  const { d } = useI18n();
  return (
    <p className="mt-5 text-center text-xs text-pretty text-muted">
      {d.legal.agree.split(/(\{terms\}|\{privacy\})/).map((part) =>
        part === "{terms}" ? (
          <Link key="terms" href="/terms" className="underline underline-offset-2 hover:text-fg">
            {d.legal.terms}
          </Link>
        ) : part === "{privacy}" ? (
          <Link key="privacy" href="/privacy" className="underline underline-offset-2 hover:text-fg">
            {d.legal.privacy}
          </Link>
        ) : (
          part
        ),
      )}
    </p>
  );
}

/** The only way in: continuing with Google signs in, and creates the account the first time. */
export function AuthCard() {
  const { d } = useI18n();
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-center font-display text-4xl font-bold tracking-tight text-balance">{d.auth.title}</h1>
      <p className="mt-2 text-center text-pretty text-muted">{d.auth.subtitle}</p>
      {/* A thin dawn line along the top edge ties the card to the brand without competing with it. */}
      <Card className="relative mt-8 overflow-hidden p-6 sm:p-10">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-dawn)]" />
        <GoogleButton />
        <Agreement />
      </Card>
    </div>
  );
}
