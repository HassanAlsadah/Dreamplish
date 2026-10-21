import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** dawn: the signature gradient button — use once per screen, for its main action. */
type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "dawn";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg shadow-[var(--shadow-card)] hover:bg-[color-mix(in_oklab,var(--primary)_84%,var(--bg))]",
  accent: "bg-accent text-accent-fg shadow-[var(--shadow-card)] hover:bg-[color-mix(in_oklab,var(--accent)_88%,var(--fg))]",
  secondary: "bg-surface text-fg border border-border hover:border-border-strong hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:bg-[color-mix(in_oklab,var(--danger)_88%,var(--fg))] dark:text-[#1a0a10]",
  // White text on the button gradient (violet → deep rose) is ≥ 5.4:1 at every point (WCAG AA).
  dawn:
    "bg-[image:var(--gradient-dawn-button)] bg-[length:160%_100%] bg-left text-white font-semibold shadow-[0_8px_24px_-10px_var(--dawn-2)] hover:bg-right",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-full",
  md: "h-11 px-5 text-[15px] rounded-xl",
  lg: "h-14 px-6 text-base rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "press inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:opacity-50 disabled:pointer-events-none [transition-property:transform,background-color,background-position,border-color,color,box-shadow,opacity]",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
