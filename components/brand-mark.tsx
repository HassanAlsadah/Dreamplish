import { BRAND } from "@/lib/site";

/** The Dreamplish mark for generated images (icons, social preview): a "D" on the dawn gradient. */
export function Mark({ px, radius = 0.22 }: { px: number; radius?: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: px * radius,
        background: `linear-gradient(135deg, ${BRAND.dawn[0]}, ${BRAND.dawn[1]} 58%, ${BRAND.dawn[2]})`,
        color: "white",
        fontSize: px * 0.66,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      D
    </div>
  );
}
