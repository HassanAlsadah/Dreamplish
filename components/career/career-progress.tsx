import { Loader2 } from "lucide-react";

/** A career tool working: spinner and what it's doing. */
export function Progress({ text }: { text: string }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
      <Loader2 aria-hidden className="size-4 animate-spin text-accent" />
      {text}
    </div>
  );
}
