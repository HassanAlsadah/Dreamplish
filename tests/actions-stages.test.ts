import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, filteredBy, type Respond } from "./fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
// A fresh board: Rejected, Application, Assessment, Interview, Offer.
const BOARD = [
  { id: id(1), category: "rejected", position: 0, is_core: true, preset: null },
  { id: id(2), category: "applied", position: 2, is_core: true, preset: null },
  { id: id(3), category: "interview", position: 3, is_core: false, preset: "assessment" },
  { id: id(4), category: "interview", position: 4, is_core: true, preset: null },
  { id: id(5), category: "offer", position: 5, is_core: true, preset: null },
];

let db: ReturnType<typeof fakeSupabase>;
vi.mock("@/lib/dal", () => ({ getUserClient: async () => ({ user: { id: USER }, supabase: db.client }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const translate = vi.fn();
vi.mock("@/lib/stage-names", () => ({ translateStageName: (name: string) => translate(name) }));

const { createStage, updateStage, deleteStage, translateStageNames } = await import("@/lib/actions/stages");

function setup(respond: Respond = () => undefined) {
  db = fakeSupabase((call) => respond(call) ?? (call.op === "update" || call.op === "delete" ? { count: 1 } : undefined));
}

beforeEach(() => {
  translate.mockReset();
  setup((call) => (call.table === "board_stages" && call.op === "select" ? { data: BOARD } : undefined));
});

describe("createStage", () => {
  it("places a new column right after Application, counting as Application", async () => {
    expect(await createStage({ name: "Call", color: "teal" })).toEqual({ ok: true });
    expect(db.find("board_stages", "insert")[0].payload).toEqual({
      name: "Call",
      color: "teal",
      category: "applied",
      user_id: USER,
      position: 2.5, // between Application (2) and Assessment (3)
    });
  });

  it("validates the name and colour, and caps the number of columns", async () => {
    expect(await createStage({ name: "  ", color: "teal" })).toMatchObject({ ok: false, error: "required" });
    expect(await createStage({ name: "Call", color: "neon" })).toMatchObject({ ok: false });
    const full = Array.from({ length: 12 }, (_, i) => ({ ...BOARD[0], id: `x${i}`, position: i }));
    setup((call) => (call.op === "select" ? { data: full } : undefined));
    expect(await createStage({ name: "Call", color: "teal" })).toMatchObject({ ok: false, error: "tooManyStages" });
    expect(db.find("board_stages", "insert")).toHaveLength(0);
  });
});

describe("updateStage", () => {
  it("clears the translation when the name changes, so it's translated again", async () => {
    await updateStage({ id: id(9), name: "Phone call" });
    expect(db.find("board_stages", "update")[0].payload).toEqual({ name: "Phone call", name_i18n: null });
  });

  it("keeps the translation when only the colour or visibility changes", async () => {
    await updateStage({ id: id(9), color: "pink", hidden: true });
    expect(db.find("board_stages", "update")[0].payload).toEqual({ color: "pink", hidden: true });
  });

  it("fails when no row was updated", async () => {
    setup((call) => (call.op === "update" ? { count: 0 } : undefined));
    expect(await updateStage({ id: id(9), hidden: true })).toMatchObject({ ok: false, error: "generic" });
  });
});

describe("deleteStage", () => {
  const rows: Record<string, unknown> = {
    [id(8)]: { id: id(8), category: "applied", is_core: false, preset: null }, // a custom "Call" column
    [id(2)]: { id: id(2), category: "applied", is_core: true, preset: null },
    [id(3)]: { id: id(3), category: "interview", is_core: false, preset: "assessment" },
  };
  beforeEach(() =>
    setup((call) => {
      if (call.table !== "board_stages" || call.op !== "select") return;
      const wanted = call.filters.find(([m, col]) => m === "eq" && col === "id")?.[2] as string;
      return { data: rows[wanted] ?? null };
    }),
  );

  it("moves the column's jobs to the target (a core target as stage_id null), then deletes it", async () => {
    expect(await deleteStage(id(8), id(2))).toEqual({ ok: true });
    const [move] = db.find("jobs", "update");
    expect(move.payload).toEqual({ stage_id: null, status: "applied" });
    expect(filteredBy(move, "stage_id", id(8))).toBe(true);
    expect(filteredBy(db.find("board_stages", "delete")[0], "id", id(8))).toBe(true);
  });

  it("refuses to delete a fixed column (core or Assessment), moving nothing", async () => {
    expect(await deleteStage(id(2), id(8))).toMatchObject({ ok: false });
    expect(await deleteStage(id(3), id(2))).toMatchObject({ ok: false });
    expect(db.find("jobs", "update")).toHaveLength(0);
    expect(db.find("board_stages", "delete")).toHaveLength(0);
  });

  it("refuses moving jobs into the column being deleted", async () => {
    expect(await deleteStage(id(8), id(8))).toMatchObject({ ok: false });
  });
});

describe("translateStageNames", () => {
  const untranslated = [
    { id: id(6), name: "Call" },
    { id: id(7), name: "Ghosted" },
  ];

  it("stores each name's translations, only if the name is unchanged meanwhile", async () => {
    setup((call) => (call.op === "select" ? { data: untranslated } : undefined));
    translate.mockImplementation(async (name: string) => (name === "Call" ? { en: "Call", ar: "اتصال" } : { en: "Ghosted", ar: "بلا رد" }));
    expect(await translateStageNames()).toEqual({ ok: true });
    const [select] = db.find("board_stages", "select");
    expect(select.filters).toContainEqual(["is", "name_i18n", null]); // only columns not translated yet
    const updates = db.find("board_stages", "update");
    expect(updates.map((u) => u.payload)).toEqual([{ name_i18n: { en: "Call", ar: "اتصال" } }, { name_i18n: { en: "Ghosted", ar: "بلا رد" } }]);
    expect(filteredBy(updates[0], "name", "Call")).toBe(true);
  });

  it("stores {} when translation fails, so it isn't retried on every visit", async () => {
    setup((call) => (call.op === "select" ? { data: [untranslated[0]] } : undefined));
    translate.mockRejectedValue(new Error("AI unavailable"));
    expect(await translateStageNames()).toEqual({ ok: true });
    expect(db.find("board_stages", "update")[0].payload).toEqual({ name_i18n: {} });
  });

  it("does nothing when every name is translated", async () => {
    setup((call) => (call.op === "select" ? { data: [] } : undefined));
    expect(await translateStageNames()).toEqual({ ok: true });
    expect(translate).not.toHaveBeenCalled();
    expect(db.find("board_stages", "update")).toHaveLength(0);
  });
});
