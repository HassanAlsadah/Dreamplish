import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/security-headers";

// Cache Components is off: every app page is per-user and reads the auth cookie,
// so nothing would prerender into a static shell anyway.
const nextConfig: NextConfig = {
  // Sign-up and sign-in are the same with Google: old /signup links land on the one sign-in page.
  async redirects() {
    return [{ source: "/signup", destination: "/login", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
