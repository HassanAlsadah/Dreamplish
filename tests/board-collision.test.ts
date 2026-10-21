import type { ClientRect } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import { boardCollision } from "@/components/jobs/board-collision";

const rect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

// Three tall columns side by side; only the middle one ("applied") has cards.
const rects = new Map<string, ClientRect>([
  ["col:rejected", rect(0, 0, 200, 900)],
  ["col:applied", rect(210, 0, 200, 900)],
  ["card:a", rect(220, 50, 180, 90)],
  ["card:b", rect(220, 150, 180, 90)],
  ["col:call", rect(420, 0, 200, 900)],
]);

function collide(pointer: { x: number; y: number } | null) {
  const draggedRect = pointer ? rect(pointer.x - 90, pointer.y - 45, 180, 90) : rect(230, 60, 180, 90);
  return boardCollision({
    active: { id: "card:a" } as never,
    collisionRect: draggedRect,
    droppableRects: rects as never,
    droppableContainers: [...rects.keys()].map((id) => ({ id, rect: { current: rects.get(id) } })) as never,
    pointerCoordinates: pointer,
  }).map((c) => c.id);
}

describe("board drop target", () => {
  it("drops into an empty column under the pointer, even near another column's cards", () => {
    expect(collide({ x: 100, y: 100 })[0]).toBe("col:rejected");
    expect(collide({ x: 430, y: 100 })[0]).toBe("col:call");
  });

  it("prefers the card under the pointer inside a column (keeps ordering)", () => {
    expect(collide({ x: 300, y: 190 })[0]).toBe("card:b");
  });

  it("falls back to the nearest target without a pointer (keyboard)", () => {
    expect(collide(null).length).toBeGreaterThan(0);
  });
});
