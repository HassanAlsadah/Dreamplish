/**
 * Remounts on every route change, so each page fades and rises in (CSS only: the content is in
 * the HTML and visible without waiting for scripts; reduced motion gets a plain fade).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
