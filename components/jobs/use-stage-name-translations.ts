"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { translateStageNames } from "@/lib/actions/stages";
import type { Stage } from "@/lib/stages";

/**
 * Custom column names get an English and Arabic version in the background (name_i18n null = not done
 * yet), then the page refreshes to show them. Asked once per set of columns.
 */
export function useStageNameTranslations(stages: Stage[]) {
  const router = useRouter();
  const untranslated = stages
    .filter((s) => s.name?.trim() && s.name_i18n === null)
    .map((s) => s.id)
    .join(",");
  const asked = useRef(new Set<string>());

  useEffect(() => {
    if (!untranslated || asked.current.has(untranslated)) return;
    asked.current.add(untranslated);
    translateStageNames()
      .then((r) => r.ok && router.refresh())
      .catch(() => {});
  }, [untranslated, router]);
}
