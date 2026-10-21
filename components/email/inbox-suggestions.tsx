"use client";

import { Check, ExternalLink, Inbox, Loader2, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EmailEvent } from "@/lib/email/service";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { fmt, formatDate } from "@/lib/i18n/config";
import { webUrl } from "@/lib/safe-url";

/** Dashboard list of job emails found in Outlook, each with an editable suggestion. */
export function InboxSuggestions({ events }: { events: EmailEvent[] }) {
  const { d } = useI18n();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ busy: boolean; done?: number; failed?: number }>({ busy: false });
  const visible = events.filter((e) => !hidden.has(e.id));
  const chosen = visible.filter((e) => selected.has(e.id));

  async function sync() {
    setSyncing(true);
    await fetch("/api/email/sync", { method: "POST" }).catch(() => null);
    setSyncing(false);
    router.refresh();
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Accept the ticked suggestions as they are (one after another, so jobs aren't created twice). */
  async function acceptSelected() {
    setBulk({ busy: true });
    let done = 0;
    let failed = 0;
    for (const e of chosen) {
      const res = await fetch(`/api/email/events/${e.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", company: e.company ?? "", role: e.role ?? "", kind: e.kind }),
      }).catch(() => null);
      if (res?.ok) {
        done++;
        setHidden((prev) => new Set(prev).add(e.id));
      } else failed++;
    }
    setSelected(new Set());
    setBulk({ busy: false, done, failed });
    router.refresh();
  }

  // Nothing to review: a slim strip instead of a full card.
  if (!visible.length) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm">
        <Inbox className="size-4 shrink-0 text-accent" />
        <span className="font-medium">{d.email.inboxTitle}</span>
        <span className="text-muted">{bulk.done ? fmt(d.email.bulkDone, { count: bulk.done }) : d.email.inboxClear}</span>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="ms-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-60"
        >
          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {syncing ? d.email.syncing : d.email.syncNow}
        </button>
      </div>
    );
  }

  return (
    <Card className="border-accent/25 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Inbox className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">
              {d.email.inboxTitle} {visible.length > 0 && <span className="text-muted">({visible.length})</span>}
            </h2>
            <p className="text-sm text-muted">{d.email.inboxHint}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={sync} disabled={syncing}>
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {syncing ? d.email.syncing : d.email.syncNow}
        </Button>
      </div>
      {visible.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSelected(new Set(visible.filter((e) => e.confidence === "high").map((e) => e.id)))}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-2"
          >
            {d.email.selectConfident}
          </button>
          {chosen.length > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-full px-3 py-1 text-xs text-muted hover:text-fg">
              {d.email.clearSelection}
            </button>
          )}
          <Button size="sm" className="ms-auto" onClick={acceptSelected} disabled={!chosen.length || bulk.busy}>
            {bulk.busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {fmt(d.email.acceptSelected, { count: chosen.length })}
          </Button>
        </div>
      )}
      {bulk.failed ? (
        <div className="mt-3">
          <Alert>{fmt(d.email.bulkFailed, { count: bulk.failed })}</Alert>
        </div>
      ) : null}
      {visible.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {visible.map((e) => (
            <Suggestion
              key={e.id}
              event={e}
              selectable={visible.length > 1}
              selected={selected.has(e.id)}
              onToggle={() => toggle(e.id)}
              onDone={() => {
                setHidden((prev) => new Set(prev).add(e.id));
                router.refresh();
              }}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Suggestion({
  event,
  onDone,
  selectable,
  selected,
  onToggle,
}: {
  event: EmailEvent;
  onDone: () => void;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const { d, locale } = useI18n();
  const [company, setCompany] = useState(event.company ?? "");
  const [role, setRole] = useState(event.role ?? "");
  const [kind, setKind] = useState<EmailEvent["kind"]>(event.kind);
  const [busy, setBusy] = useState<"accept" | "ignore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kindLabel: Record<EmailEvent["kind"], string> = {
    applied: d.email.kindApplied,
    assessment: d.email.kindAssessment,
    interview: d.email.kindInterview,
    offer: d.email.kindOffer,
    rejected: d.email.kindRejected,
  };

  async function act(action: "accept" | "ignore") {
    if (action === "accept" && event.action === "create" && !company.trim()) return setError(d.email.errCompany);
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/email/events/${event.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "accept" ? { action, company, role, kind } : { action }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) onDone();
    else setError(d.errors.generic);
  }

  // Same column the job is already in (Assessment / Interview) = another round, not a move.
  const isRound = event.action === "update" && !!event.currentColumn && kind === event.currentColumn;
  const updateText = isRound ? d.email.suggestRound : d.email.suggestUpdate;

  const input = "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35";

  const postingUrl = webUrl(event.job_link);
  const emailUrl = webUrl(event.web_link);
  return (
    <li className={cn("rounded-2xl border bg-surface-2 p-4 transition-colors", selected ? "border-accent" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={fmt(d.email.selectOne, { subject: event.subject ?? "" })}
            className="size-4 accent-[var(--accent)]"
          />
        )}
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-medium text-accent">{kindLabel[event.kind]}</span>
        {event.direction === "sent" && <span className="rounded-full bg-surface px-2.5 py-0.5 font-medium">{d.email.sentByYou}</span>}
        {event.applied_via && <span className="text-muted">{fmt(d.email.via, { channel: d.appliedVia[event.applied_via] })}</span>}
        {event.detail && (
          <span className="text-[11px] text-muted" dir="auto">
            {event.detail}
          </span>
        )}
        {event.confidence === "low" && (
          <span className="rounded-full bg-status-interview/20 px-2.5 py-0.5 font-medium">{d.email.lowConfidence}</span>
        )}
        <span className="text-muted">{formatDate(event.received_at, locale)}</span>
        {postingUrl && (
          <a href={postingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg">
            <ExternalLink className="size-3" />
            {d.email.openPosting}
          </a>
        )}
        {event.job_description && <span className="text-muted">· {d.email.hasDescription}</span>}
        {emailUrl && (
          <a href={emailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg">
            <ExternalLink className="size-3" />
            {d.email.openEmail}
          </a>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm" dir="auto" title={event.subject ?? ""}>
        <span className="text-muted">{event.direction === "sent" ? fmt(d.email.to, { name: event.sender ?? "" }) : `${event.sender}:`}</span>{" "}
        {event.subject}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {event.action === "create" ? (
          <>
            <span className="w-full text-sm font-medium">{d.email.suggestCreate}</span>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {d.email.company}
              <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} dir="auto" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {d.email.role}
              <input className={input} value={role} onChange={(e) => setRole(e.target.value)} maxLength={200} dir="auto" />
            </label>
          </>
        ) : (
          <span className="w-full text-sm font-medium" dir="auto">
            {event.job_id ? (
              <Link href={`/jobs/${event.job_id}`} className="hover:underline">
                {fmt(updateText, { job: `${event.job?.title ?? event.role ?? ""} · ${event.company ?? ""}` })}
              </Link>
            ) : (
              fmt(updateText, { job: event.role ?? "" })
            )}
          </span>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          {d.stages.column}
          {/* Email updates use a fixed set of columns. */}
          <select className={input} value={kind} onChange={(e) => setKind(e.target.value as EmailEvent["kind"])}>
            {(["applied", "assessment", "interview", "offer", "rejected"] as const).map((k) => (
              <option key={k} value={k}>
                {kindLabel[k]}
              </option>
            ))}
          </select>
        </label>
        <div className="ms-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => act("ignore")} disabled={busy !== null}>
            {busy === "ignore" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            {d.email.ignore}
          </Button>
          <Button size="sm" variant="primary" onClick={() => act("accept")} disabled={busy !== null}>
            {busy === "accept" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {d.email.accept}
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </li>
  );
}
