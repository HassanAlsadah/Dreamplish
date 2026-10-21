import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/site";

/** Lets the app be installed to a phone's home screen; it opens on the dashboard. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dreamplish",
    short_name: "Dreamplish",
    description: "Track your job applications and get a company briefing before every interview.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: BRAND.night,
    theme_color: BRAND.night,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
