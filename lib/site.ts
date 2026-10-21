/** The app's public address (NEXT_PUBLIC_SITE_URL in production), for absolute links in metadata. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Brand colours used outside the stylesheet (generated icons, social image, manifest). */
export const BRAND = { dawn: ["#6a4cf0", "#d63c6f", "#f2a93b"], ink: "#141414", night: "#050505" } as const;

/** Pages signed-out visitors and search engines may see. Everything else is per-user. */
export const PUBLIC_PAGES = ["/", "/login", "/privacy", "/terms"] as const;
