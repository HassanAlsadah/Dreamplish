import { Plus } from "lucide-react";
import Link from "next/link";

/** Top bar "Add job": on every signed-in page (icon only on phones). Shortcut N on the dashboard. */
export function AddJobLink({ label }: { label: string }) {
  return (
    <Link
      href="/jobs/new"
      aria-label={label}
      title={`${label} (N)`}
      className="me-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-topbar-fg px-2.5 text-sm font-medium text-topbar transition hover:opacity-90 sm:px-3.5"
    >
      <Plus className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
