import { getJobHistory } from "@/lib/history-server";
import type { Job } from "@/lib/types";
import { StatusTimeline } from "./status-timeline";

/** Server part of the timeline: fetches history (streamed behind Suspense) and hands it to the client graph. */
export async function StatusTimelineSection({ job, compact = false }: { job: Job; compact?: boolean }) {
  const { entries, now } = await getJobHistory(job.id);
  return (
    <StatusTimeline
      entries={entries}
      jobId={job.id}
      jobCreatedAt={job.created_at}
      currentStatus={job.status}
      now={now}
      compact={compact}
    />
  );
}
