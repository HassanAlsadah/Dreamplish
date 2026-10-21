"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { deleteAccount } from "@/lib/actions/account";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";

/** Profile page: delete the account and all its data, after typing the account's email to confirm. */
export function DeleteAccount({ email }: { email: string }) {
  const { d } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState(deleteAccount, { ok: false });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const error = state.error === "confirmMismatch" ? d.account.confirmMismatch : state.error ? d.account.failed : null;

  return (
    <Card className="border-danger/30 p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{d.account.deleteTitle}</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">{d.account.deleteBody}</p>
      <Button type="button" variant="danger" className="mt-5" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden className="size-4" />
        {d.account.deleteButton}
      </Button>

      <dialog
        ref={ref}
        onClose={() => {
          setOpen(false);
          setTyped("");
        }}
        aria-labelledby="delete-account-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border bg-surface p-6 text-fg backdrop:bg-black/50"
      >
        <h2 id="delete-account-title" className="text-lg font-semibold">
          {d.account.confirmTitle}
        </h2>
        <p className="mt-1 text-sm text-muted">{d.account.confirmBody}</p>
        <form action={action} className="mt-5 flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          <Field label={fmt(d.account.confirmLabel, { email })} htmlFor="delete-confirm">
            <Input
              id="delete-confirm"
              name="confirm"
              type="email"
              dir="ltr"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email}
            />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {d.account.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={!matches || pending}>
              {pending ? d.account.deleting : d.account.confirmButton}
            </Button>
          </div>
        </form>
      </dialog>
    </Card>
  );
}
