import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/site";
import { Mark } from "@/components/brand-mark";

export const alt = "Dreamplish — from the dream to the offer. Track your job applications and get a company briefing before every interview.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview shown when a Dreamplish link is shared. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: BRAND.night, color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 88, height: 88, display: "flex" }}>
            <Mark px={88} />
          </div>
          <div style={{ fontSize: 52, fontWeight: 700 }}>Dreamplish</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>From the dream to the offer.</div>
          <div style={{ fontSize: 32, color: "#b8b8b4", lineHeight: 1.35, maxWidth: 940 }}>
            Track every application, check your fit and tailor your CV, and get a sourced company briefing before every interview.
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: `linear-gradient(90deg, ${BRAND.dawn[0]}, ${BRAND.dawn[1]} 55%, ${BRAND.dawn[2]})` }} />
      </div>
    ),
    size,
  );
}
