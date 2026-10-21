import { describe, expect, it } from "vitest";
import { changeDateSchema } from "@/lib/schemas/history";

const ID = "00000000-0000-4000-8000-000000000001";
const schema = changeDateSchema("2026-10-01T09:00:00Z");

describe("changeDateSchema", () => {
  it("accepts a past date after the job was created", () => {
    expect(schema.safeParse({ id: ID, changedAt: "2026-10-05T10:00:00Z" }).success).toBe(true);
  });
  it("rejects a future date", () => {
    const r = schema.safeParse({ id: ID, changedAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("futureDate");
  });
  it("needs confirmation for a date before the job was created", () => {
    const early = { id: ID, changedAt: "2026-09-01T10:00:00Z" };
    expect(schema.safeParse(early).error?.issues[0].message).toBe("beforeCreated");
    expect(schema.safeParse({ ...early, confirmBeforeCreated: true }).success).toBe(true);
  });
});
