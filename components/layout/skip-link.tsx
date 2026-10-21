/** First thing keyboard users reach: jumps past the top bar to the page content (#main). */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-[var(--shadow-pop)] focus:outline-2 focus:outline-ring"
    >
      {label}
    </a>
  );
}
