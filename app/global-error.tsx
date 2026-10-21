"use client";

import { useEffect } from "react";

/**
 * Last-resort error page, used when the root layout itself fails. It replaces the whole document, so
 * it can't use the app's styles, fonts or translations: plain inline styles that follow the system
 * theme, and both languages.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <title>Dreamplish — Something went wrong</title>
        <style>{`
          :root { color-scheme: light dark; --bg: #f7f7f6; --fg: #141414; --muted: #5e5e5a; --btn: #141414; --btn-fg: #fff; }
          @media (prefers-color-scheme: dark) { :root { --bg: #0b0b0b; --fg: #f3f3f2; --muted: #a3a3a0; --btn: #f3f3f2; --btn-fg: #141414; } }
          .ge { min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg);
                font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; padding: 24px; text-align: center; }
          .ge p { color: var(--muted); margin: 6px 0; }
          .ge button { margin-top: 20px; border: 0; border-radius: 999px; padding: 12px 22px; font-size: 15px;
                       background: var(--btn); color: var(--btn-fg); cursor: pointer; }
          .ge small { display: block; margin-top: 14px; color: var(--muted); }
        `}</style>
        <main className="ge">
          <div>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
            <p>An unexpected error happened. You can try again.</p>
            <p dir="rtl" lang="ar">صار خطأ غير متوقع. تقدر تحاول مرة ثانية.</p>
            <button type="button" onClick={() => retry()}>
              Try again · حاول مرة ثانية
            </button>
            {error.digest && <small>Ref: {error.digest}</small>}
          </div>
        </main>
      </body>
    </html>
  );
}
