"use client";

import { useEffect, type RefObject } from "react";
import type { ActionState } from "@/lib/types";

/** After a submit with field errors, move focus to the first invalid field (its error is announced). */
export function useFocusFirstError(formRef: RefObject<HTMLFormElement | null>, state: ActionState) {
  useEffect(() => {
    if (!state.fieldErrors || !Object.keys(state.fieldErrors).length) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [formRef, state]);
}
