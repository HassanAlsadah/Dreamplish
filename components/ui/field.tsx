import { CircleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Focus: a 2px ring in the accent colour (≥ 3:1) and the field lifts to the surface colour.
const control =
  "w-full rounded-xl border bg-surface-2 text-fg placeholder:text-muted " +
  "[transition-property:border-color,background-color,box-shadow] duration-150 " +
  "hover:border-border-strong/60 focus:outline-none focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/35";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optionalLabel,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[15px] font-semibold text-fg">
        {label}
        {optionalLabel && <span className="ms-2 text-xs font-normal text-muted">{optionalLabel}</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-sm text-danger" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

// Fields default to autoComplete="off" so password managers don't offer to fill job details; sign-in
// fields pass their own value ("email", "current-password", …). Links and emails aren't spellchecked.
export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      autoComplete="off"
      spellCheck={props.type === "url" || props.type === "email" ? false : undefined}
      aria-invalid={invalid || undefined}
      className={cn(control, "h-14 px-4 text-[15px]", invalid ? "border-danger" : "border-border", className)}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      autoComplete="off"
      aria-invalid={invalid || undefined}
      className={cn(control, "min-h-28 px-4 py-3 text-[15px] leading-relaxed", invalid ? "border-danger" : "border-border", className)}
      {...props}
    />
  );
}

export function Select({ className, invalid, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(control, "select-native h-14 ps-4 text-[15px]", invalid ? "border-danger" : "border-border", className)}
      {...props}
    />
  );
}
