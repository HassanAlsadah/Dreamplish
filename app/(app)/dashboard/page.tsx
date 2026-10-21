import type { Metadata } from "next";
import { Dashboard, type View } from "@/components/jobs/dashboard";
import { InboxSuggestions } from "@/components/email/inbox-suggestions";
import { DraftsStrip } from "@/components/jobs/drafts-strip";
import { listDrafts, listHistory, listJobs, listStages, requireUser } from "@/lib/dal";
import { getConnections, pendingEvents } from "@/lib/email/service";
import { syncInBackgroundIfDue } from "@/lib/email/sync";
import { getI18n } from "@/lib/i18n/server";
import { JOB_STATUSES } from "@/lib/types";
import { isUuid } from "@/lib/schemas/common";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.nav.dashboard };
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const view: View = one(sp.view) === "list" ? "list" : "kanban";
  const q = one(sp.q).slice(0, 100);

  const user = await requireUser();
  const [jobs, connections, stages, { history, now }, drafts] = await Promise.all([
    listJobs(),
    getConnections(user.id),
    listStages(),
    listHistory(),
    listDrafts(),
  ]);
  const connected = connections.length > 0;
  // ?stage=<id>, or the older ?status=<status> (→ that status's core column).
  const legacy = (JOB_STATUSES as readonly string[]).includes(one(sp.status))
    ? stages.find((s) => s.is_core && s.category === one(sp.status))?.id
    : undefined;
  const stage = stages.some((s) => s.id === one(sp.stage)) ? one(sp.stage) : (legacy ?? "");
  const events = connected ? await pendingEvents() : [];

  // Hourly inbox check while the app runs locally: syncs after this response if the last sync is over an hour old.
  // The least recently synced mailbox decides (a never-synced one counts as due).
  if (connected) syncInBackgroundIfDue(user.id, connections.some((c) => !c.lastSyncedAt) ? null : connections.map((c) => c.lastSyncedAt!).sort()[0]);

  return (
    <Dashboard
      jobs={jobs}
      initialView={view}
      initialQuery={q}
      initialStage={stage}
      stages={stages}
      inbox={connected ? <InboxSuggestions key="inbox" events={events} /> : null}
      drafts={<DraftsStrip drafts={drafts} />}
      history={history}
      now={now}
      // From the job page's Delete: removed with an Undo toast (a job id, or nothing).
      initialDelete={isUuid(one(sp.delete)) ? one(sp.delete) : undefined}
    />
  );
}
