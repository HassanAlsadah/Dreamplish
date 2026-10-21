import { closestCorners, pointerWithin, type CollisionDetection } from "@dnd-kit/core";

/** Drag-and-drop ids on the board: columns and cards. */
export const COL = "col:";
export const CARD = "card:";

/**
 * Where a dragged card lands: the card or column under the pointer. Columns stretch to the tallest
 * one, so with corner distance alone an empty column's far-away corners lose to a card in the
 * column next to it and the drop never reaches it. Corner distance is only the fallback (keyboard
 * dragging, or a pointer between columns).
 */
export const boardCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length) {
    const card = within.find((c) => String(c.id).startsWith(CARD));
    return card ? [card] : within;
  }
  return closestCorners(args);
};
