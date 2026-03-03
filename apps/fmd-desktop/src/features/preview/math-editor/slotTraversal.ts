import { areSlotPathsEqual, listAllSlotPaths, locateRowByPath } from "./ast";
import type { FormulaRowNode, MathCursor, SlotPath } from "./types";

export const normalizeCursor = (root: FormulaRowNode, cursor: MathCursor): MathCursor => {
  const located = locateRowByPath(root, cursor.rowPath);
  if (!located) {
    return {
      rowPath: [],
      offset: Math.max(0, Math.min(cursor.offset, root.children.length)),
      selection: null,
    };
  }
  const rowLength = located.row.children.length;
  const selection = cursor.selection
    ? {
      start: Math.max(0, Math.min(cursor.selection.start, rowLength)),
      end: Math.max(0, Math.min(cursor.selection.end, rowLength)),
    }
    : null;
  return {
    rowPath: cursor.rowPath,
    offset: Math.max(0, Math.min(cursor.offset, rowLength)),
    selection,
  };
};

export const getAdjacentSlotPath = (
  root: FormulaRowNode,
  currentPath: SlotPath,
  direction: "next" | "previous",
) => {
  const slotPaths = listAllSlotPaths(root);
  const currentIndex = slotPaths.findIndex((path) => areSlotPathsEqual(path, currentPath));
  if (currentIndex < 0) {
    return direction === "next" ? slotPaths[0] ?? [] : slotPaths[slotPaths.length - 1] ?? [];
  }
  if (direction === "next") {
    return slotPaths[Math.min(slotPaths.length - 1, currentIndex + 1)] ?? currentPath;
  }
  return slotPaths[Math.max(0, currentIndex - 1)] ?? currentPath;
};
