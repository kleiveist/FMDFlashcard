import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { areSlotPathsEqual, getSlotLabel, locateRowByPath } from "./ast";
import { getAdjacentSlotPath } from "./slotTraversal";
import { MathStructureNode } from "./MathStructureNode";
import type {
  FormulaRowNode,
  MathEditorCommand,
  MathStructureSessionState,
  SlotPath,
} from "./types";

const pathKey = (path: SlotPath) =>
  path
    .map(
      (segment) =>
        `${segment.nodeId}:${segment.slotName}:${segment.rowIndex ?? ""}:${segment.colIndex ?? ""}`,
    )
    .join("/");

export const MathStructureCanvas = ({
  state,
  onDispatch,
}: {
  state: MathStructureSessionState;
  onDispatch: (command: MathEditorCommand) => void;
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const focusCanvas = () => {
    const node = rootRef.current;
    if (!node) {
      return;
    }
    try {
      node.focus({ preventScroll: true });
    } catch {
      node.focus();
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const activeKey = pathKey(state.cursor.rowPath);
    const activeRow = Array.from(root.querySelectorAll<HTMLElement>("[data-md-math-row]")).find(
      (node) => node.getAttribute("data-md-math-row") === activeKey,
    );
    activeRow?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [state.cursor.rowPath]);

  const renderRow = (row: FormulaRowNode, path: SlotPath, label: string, compact = false) => {
    const isActive = areSlotPathsEqual(path, state.cursor.rowPath);
    const selection = isActive ? state.cursor.selection : null;
    return (
      <span
        key={`${row.id}:${pathKey(path)}`}
        className={`markdown-hybrid-structural-math-row${compact ? " is-compact" : ""}${
          isActive ? " is-active" : ""
        }`}
        data-md-math-row={pathKey(path)}
        data-md-math-active-slot={isActive ? "true" : undefined}
        aria-label={label}
        onMouseDown={(event) => {
          event.preventDefault();
          onDispatch({
            type: "setCursor",
            cursor: {
              rowPath: path,
              offset: row.children.length,
              selection: null,
            },
          });
          focusCanvas();
        }}
      >
        {row.children.length === 0 ? (
          <span className="markdown-hybrid-structural-math-placeholder">□</span>
        ) : null}
        {Array.from({ length: row.children.length + 1 }, (_item, boundaryIndex) => (
          <span
            key={`${row.id}-boundary-${boundaryIndex}`}
            className={`markdown-hybrid-structural-math-boundary${
              isActive && state.cursor.offset === boundaryIndex && !selection ? " is-caret" : ""
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDispatch({
                type: "setCursor",
                cursor: {
                  rowPath: path,
                  offset: boundaryIndex,
                  selection: null,
                },
              });
              focusCanvas();
            }}
          >
            {boundaryIndex < row.children.length ? (
              <MathStructureNode
                node={row.children[boundaryIndex]!}
                path={path}
                renderRow={renderRow}
                onDispatch={onDispatch}
              />
            ) : null}
          </span>
        ))}
      </span>
    );
  };

  const currentSlotLabel = useMemo(() => {
    const slot = state.cursor.rowPath[state.cursor.rowPath.length - 1];
    return slot ? getSlotLabel(slot) : "Formula";
  }, [state.cursor.rowPath]);

  return (
    <div className="markdown-hybrid-structural-math-canvas-shell">
      <div className="markdown-hybrid-structural-math-pane-title-row">
        <div className="markdown-hybrid-structural-math-pane-title">Structure</div>
        <div className="markdown-hybrid-structural-math-pane-meta">{currentSlotLabel}</div>
      </div>
      <div className="markdown-hybrid-structural-math-canvas-viewport">
        <div
          ref={rootRef}
          className="markdown-hybrid-structural-math-canvas"
          style={
            {
              "--md-math-canvas-scale": `${state.canvasZoom / 100}`,
            } as CSSProperties
          }
          tabIndex={0}
          role="group"
          aria-label={`Math structure canvas, active slot ${currentSlotLabel}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
              event.preventDefault();
              onDispatch({ type: event.shiftKey ? "redo" : "undo" });
              return;
            }
            if (event.key === "Tab") {
              event.preventDefault();
              const nextPath = getAdjacentSlotPath(
                state.ast,
                state.cursor.rowPath,
                event.shiftKey ? "previous" : "next",
              );
              const nextRow = locateRowByPath(state.ast, nextPath)?.row ?? state.ast;
              onDispatch({
                type: "setCursor",
                cursor: {
                  rowPath: nextPath,
                  offset: Math.min(state.cursor.offset, nextRow.children.length),
                  selection: null,
                },
              });
              return;
            }
            if (
              event.key === "ArrowLeft" ||
              event.key === "ArrowRight" ||
              event.key === "ArrowUp" ||
              event.key === "ArrowDown"
            ) {
              event.preventDefault();
              onDispatch({
                type: "moveCursor",
                direction:
                  event.key === "ArrowLeft"
                    ? "left"
                    : event.key === "ArrowRight"
                      ? "right"
                      : event.key === "ArrowUp"
                        ? "up"
                        : "down",
                extend: event.shiftKey,
              });
              return;
            }
            if (event.key === "Backspace") {
              event.preventDefault();
              onDispatch({ type: "deleteBackward" });
              return;
            }
            if (event.key === "Delete") {
              event.preventDefault();
              onDispatch({ type: "deleteForward" });
              return;
            }
            if (event.key === "/") {
              event.preventDefault();
              onDispatch({ type: "insertTemplate", templateId: "fraction" });
              return;
            }
            if (event.key === "^") {
              event.preventDefault();
              onDispatch({ type: "insertTemplate", templateId: "superscript" });
              return;
            }
            if (event.key === "_") {
              event.preventDefault();
              onDispatch({ type: "insertTemplate", templateId: "subscript" });
              return;
            }
            if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              onDispatch({ type: "insertText", text: event.key });
            }
          }}
        >
          {renderRow(state.ast, [], "Formula")}
        </div>
      </div>
    </div>
  );
};
