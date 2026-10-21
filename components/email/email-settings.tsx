"use client";

import { History, Loader2, Mail, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EmailConnectionView, MailProvider } from "@/lib/email/service";
import { useI18n } from "@/lib/i18n/client";
import { fmt, intlTag } from "@/lib/i18n/config";

const PROVIDERS: { id: MailProvider; name: string; color: string }[] = [
  { id: "outlook", name: "Outlook", color: "#0078d4" },
  { id: "gmail", name: "Gmail", color: "#d93025" },
];

/**
 * Profile card: connect Outlook and/or Gmail (one row each), plus Sync now and the past-email
 * re-read, which cover every connected mailbox. Only providers set up on the server are offered (a
 * mailbox that's already connected always shows, so it can be disconnected).
 */
export function EmailSettings({
  connections,
  available,
  flash,
}: {
  connections: EmailConnectionView[];
  available: MailProvider[];
  flash?: string;
}) {
  const { d, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "reread" | MailProvider | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = PROVIDERS.filter((p) => available.includes(p.id) || connections.some((c) => c.provider === p.id));

  // ?email=connected (Outlook) or ?email=gmail_connected (Gmail), and the failures.
  const flashProvider = PROVIDERS.find((p) => (p.id === "gmail" ? flash?.startsWith("gmail_") : flash && !flash.startsWith("gmail_")));
  const flashCode = flash?.replace(/^gmail_/, "");
  const flashText = !flash || !flashProvider
    ? null
    : flashCode === "connected"
      ? { ok: true, text: fmt(d.email.msgConnected, { provider: flashProvider.name }) }
      : flashCode === "denied"
        ? { ok: false, text: fmt(d.email.msgDenied, { provider: flashProvider.name }) }
        : flashCode === "not_configured"
          ? { ok: false, text: fmt(d.email.msgNotConfigured, { provider: flashProvider.name }) }
          : { ok: false, text: fmt(d.email.msgAuthFailed, { provider: flashProvider.name }) };

  const time = (iso: string) =>
    new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  async function sync() {
    setBusy("sync");
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/email/sync", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { data?: { candidates: number; suggestions: number; fetched: number }; error?: string };
      if (!res.ok || !json.data) setError(json.error === "reconnect" ? d.email.errReconnect : json.error === "rate_limited" ? d.errors.tooMany : d.email.errSync);
      else setNote(fmt(d.email.syncDone, { count: json.data.fetched, found: json.data.suggestions }));
      router.refresh();
    } catch {
      setError(d.errors.network);
    } finally {
      setBusy(null);
    }
  }

  /** One-off: fill in links, roles and descriptions on jobs from emails already processed. */
  async function reread() {
    setBusy("reread");
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/email/reread", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { data?: { emails: number; jobsUpdated: number; descriptionsFound: number }; error?: string };
      if (!res.ok || !json.data) {
        setError(json.error === "reconnect" ? d.email.errReconnect : json.error === "rate_limited" ? d.errors.tooMany : d.email.errReread);
      } else {
        setNote(fmt(d.email.rereadDone, { emails: json.data.emails, jobs: json.data.jobsUpdated, found: json.data.descriptionsFound }));
      }
      router.refresh();
    } catch {
      setError(d.errors.network);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: (typeof PROVIDERS)[number]) {
    if (!confirm(fmt(d.email.disconnectConfirm, { provider: provider.name }))) return;
    setBusy(provider.id);
    await fetch(`/api/email/${provider.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-fg">
          <Mail className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">{d.email.title}</h2>
          <p className="mt-1 text-sm text-muted">{d.email.intro}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {flashText && <Alert tone={flashText.ok ? "success" : "danger"}>{flashText.text}</Alert>}

        <ul className="flex flex-col gap-3">
          {shown.map((p) => {
            const connection = connections.find((c) => c.provider === p.id);
            return (
              <li key={p.id} className="rounded-2xl border border-border bg-surface-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="font-semibold">{p.name}</span>
                  {connection ? (
                    <span className="min-w-0 flex-1 truncate text-muted" dir="ltr">
                      {connection.accountEmail}
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  {connection ? (
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => disconnect(p)} disabled={busy !== null}>
                      {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                      {d.email.disconnect}
                    </Button>
                  ) : (
                    // Full page navigation: the provider's sign-in, then back to /api/email/<provider>/callback.
                    <a href={`/api/email/${p.id}/connect`} className={buttonClass("primary", "sm")}>
                      <Mail className="size-4" />
                      {fmt(d.email.connect, { provider: p.name })}
                    </a>
                  )}
                </div>
                {connection && (
                  <div className="mt-2 text-xs text-muted">
                    <p>{connection.lastSyncedAt ? fmt(d.email.lastSync, { time: time(connection.lastSyncedAt) }) : d.email.neverSynced}</p>
                    {connection.status === "error" && connection.error && (
                      <p className="mt-1 text-danger">{fmt(d.email.statusError, { error: connection.error })}</p>
                    )}
                  </div>
                )}
                {p.id === "gmail" && <p className="mt-2 text-xs text-muted">{d.email.gmailTesting}</p>}
              </li>
            );
          })}
        </ul>

        {connections.length > 0 && (
          <>
            <p className="text-xs text-muted">
              {d.email.autoNote} {d.email.rereadHint}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={sync} disabled={busy !== null}>
                {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {busy === "sync" ? d.email.syncing : d.email.syncNow}
              </Button>
              <Button variant="secondary" onClick={reread} disabled={busy !== null} title={d.email.rereadHint}>
                {busy === "reread" ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
                {busy === "reread" ? d.email.rereading : d.email.reread}
              </Button>
            </div>
          </>
        )}
        {note && <Alert tone="success">{note}</Alert>}
        {error && <Alert>{error}</Alert>}
        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          {d.email.privacy}
        </p>
      </div>
    </Card>
  );
}
