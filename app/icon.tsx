import { ImageResponse } from "next/og";
import { Mark } from "@/components/brand-mark";

// Browser tab (32px) and home-screen / manifest sizes (192, 512).
export function generateImageMetadata() {
  return [32, 192, 512].map((px) => ({ id: String(px), size: { width: px, height: px }, contentType: "image/png" }));
}

/** The Dreamplish mark: a "D" on the dawn gradient. */
export default async function Icon({ id }: { id: Promise<string | number> }) {
  const px = Number(await id);
  return new ImageResponse(<Mark px={px} />, { width: px, height: px });
}
