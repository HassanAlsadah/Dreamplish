"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markApplied } from "@/lib/actions/jobs";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

/** Today's date where the user is (the server's clock may already be on another day). */
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** "I applied": moves a draft (a checked job) to Application, keeping its match and tailored CV. */
export function MarkAppliedButton({ jobId, size = "md", className }: { jobId: string; size?: "sm" | "md"; className?: string }) {
  const { d } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const apply = () =>
    startTransition(async () => {
      setFailed(false);
      const result = await markApplied(jobId, localToday()).catch(() => ({ ok: false }));
      if (!result.ok) return setFailed(true);
      router.refresh();
    });

  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <Button type="button" variant="primary" size={size} onClick={apply} disabled={pending}>
        <Send aria-hidden className="size-4" />
        {pending ? d.job.saving : d.check.applied}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-danger">
          {d.check.appliedFailed}
        </span>
      )}
    </span>
  );
}
