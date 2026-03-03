import { areSlotPathsEqual, locateRowByPath } from "./ast";
import { getAdjacentSlotPath, normalizeCursor } from "./slotTraversal";
import type { FormulaRowNode, MathCursor } from "./types";

export const moveCursorHorizontally = (
  root: FormulaRowNode,
  cursor: MathCursor,
  direction: "left" | "right",
  extend = false,
): MathCursor => {
  const normalized = normalizeCursor(root, cursor);
  const located = locateRowByPath(root, normalized.rowPath);
  if (!located) {
    return normalized;
  }
  const rowLength = located.row.children.length;
  if (direction === "left") {
    if (normalized.selection && !extend) {
      const collapsed = Math.min(normalized.selection.start, normalized.selection.end);
      return { rowPath: normalized.rowPath, offset: collapsed, selection: null };
    }
    if (normalized.offset > 0) {
      const nextOffset = normalized.offset - 1;
      return extend
        ? {
          rowPath: normalized.rowPath,
          offset: nextOffset,
          selection: {
            start: normalized.selection?.start ?? normalized.offset,
            end: nextOffset,
          },
        }
        : { rowPath: normalized.rowPath, offset: nextOffset, selection: null };
    }
    const previousPath = getAdjacentSlotPath(root, normalized.rowPath, "previous");
    if (areSlotPathsEqual(previousPath, normalized.rowPath)) {
      return normalized;
    }
    const previousRow = locateRowByPath(root, previousPath)?.row ?? root;
    return {
      rowPath: previousPath,
      offset: previousRow.children.length,
      selection: null,
    };
  }
  if (normalized.selection && !extend) {
    const collapsed = Math.max(normalized.selection.start, normalized.selection.end);
    return { rowPath: normalized.rowPath, offset: collapsed, selection: null };
  }
  if (normalized.offset < rowLength) {
    const nextOffset = normalized.offset + 1;
    return extend
      ? {
        rowPath: normalized.rowPath,
        offset: nextOffset,
        selection: {
          start: normalized.selection?.start ?? normalized.offset,
          end: nextOffset,
        },
      }
      : { rowPath: normalized.rowPath, offset: nextOffset, selection: null };
  }
  const nextPath = getAdjacentSlotPath(root, normalized.rowPath, "next");
  if (areSlotPathsEqual(nextPath, normalized.rowPath)) {
    return normalized;
  }
  return {
    rowPath: nextPath,
    offset: 0,
    selection: null,
  };
};

export const moveCursorVertically = (
  root: FormulaRowNode,
  cursor: MathCursor,
  direction: "up" | "down",
): MathCursor => {
  const normalized = normalizeCursor(root, cursor);
  const targetPath = getAdjacentSlotPath(root, normalized.rowPath, direction === "down" ? "next" : "previous");
  const targetRow = locateRowByPath(root, targetPath)?.row;
  if (!targetRow) {
    return normalized;
  }
  return {
    rowPath: targetPath,
    offset: Math.min(normalized.offset, targetRow.children.length),
    selection: null,
  };
};
