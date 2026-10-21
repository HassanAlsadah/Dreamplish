"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client";

/**
 * Shared error boundary UI (signed-in and public pages). "Try again" re-fetches and re-renders the
 * failed part. In production the message is generic; error.digest matches the server log entry.
 */
export function ErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { d } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <Card className="mx-auto my-10 flex max-w-lg flex-col items-center gap-4 p-10 text-center">
      <h1 className="font-display text-2xl font-bold">{d.errors.errorTitle}</h1>
      <p className="text-muted">{d.errors.errorBody}</p>
      <Button onClick={() => retry()}>{d.errors.retry}</Button>
      {error.digest && <p className="text-xs text-muted tabular-nums">Ref: {error.digest}</p>}
    </Card>
  );
}
