import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/site";

/** Only the public pages are for search engines; the rest is per-user (and needs sign-in anyway). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: [...PUBLIC_PAGES], disallow: ["/dashboard", "/jobs", "/profile", "/companies", "/cv", "/api", "/auth"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
