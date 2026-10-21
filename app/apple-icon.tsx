import { ImageResponse } from "next/og";
import { Mark } from "@/components/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so the mark fills the square.
export default function AppleIcon() {
  return new ImageResponse(<Mark px={180} radius={0} />, size);
}
