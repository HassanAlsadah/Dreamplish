import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
