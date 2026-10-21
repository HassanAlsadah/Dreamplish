"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Shows a one-time message for ?saved=1 / ?deleted=1 and cleans the URL. */
export function FlashToast() {
  const { d } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flash = params.get("saved") ? d.job.saved : params.get("deleted") ? d.job.deleted : null;

  const [message, setMessage] = useState<string | null>(null);
  const [lastFlash, setLastFlash] = useState<string | null>(null);
  if (flash !== lastFlash) {
    setLastFlash(flash);
    if (flash) setMessage(flash);
  }

  useEffect(() => {
    if (!flash) return;
    const next = new URLSearchParams(params);
    next.delete("saved");
    next.delete("deleted");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [flash, params, pathname, router]);

  return <Toast message={message} onClose={() => setMessage(null)} />;
}

/** Shows a toast whenever an action result changes to one that should be announced. */
export function useActionToast<T>(state: T, pick: (state: T) => string | null) {
  const [message, setMessage] = useState<string | null>(null);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    const text = pick(state);
    if (text) setMessage(text);
  }
  return [message, () => setMessage(null)] as const;
}

export function Toast({
  message,
  onClose,
  tone = "success",
  action,
  duration = 4000,
}: {
  message: string | null;
  onClose: () => void;
  tone?: "success" | "danger";
  /** e.g. Undo. */
  action?: { label: string; onClick: () => void };
  duration?: number;
}) {
  const { d } = useI18n();

  // Keep the latest onClose without restarting the timer on every render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {/* Black pill in both themes (fixed colours, independent of the top bar), with a coloured edge for its tone; rises in (fades with reduced motion). */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "on-dark toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border-s-4 bg-[#111111] px-4 py-3 text-sm text-[#f5f5f4] shadow-[var(--shadow-pop)]",
          tone === "danger" ? "border-[#ff6b7d]" : "border-[#3ccf91]",
        )}
      >
        {tone === "danger" ? (
          <CircleAlert className="size-4 shrink-0 text-[#ff8a98]" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-[#5ee0a5]" aria-hidden />
        )}
        <span>{message}</span>
        {action && (
          <button type="button" onClick={action.onClick} className="press rounded-lg px-2 py-0.5 font-semibold text-[#cfc8ff] underline-offset-2 hover:underline">
            {action.label}
          </button>
        )}
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100" aria-label={d.common.close}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
