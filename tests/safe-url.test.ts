import { describe, expect, it } from "vitest";
import { webUrl } from "@/lib/safe-url";

describe("webUrl", () => {
  it("keeps http(s) links", () => {
    expect(webUrl("https://careers.aramco.com/job/1")).toBe("https://careers.aramco.com/job/1");
    expect(webUrl("http://example.com")).toBe("http://example.com/");
  });
  it.each(["javascript:alert(document.cookie)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///etc/passwd", "not a url", "", null, undefined])(
    "drops %s",
    (value) => expect(webUrl(value)).toBeNull(),
  );
});
