import { useEffect, useMemo, useReducer, useRef } from "react";
import { ModalShell } from "../../../components/ModalShell";
import { getComputeEngineAdapterStatus } from "./computeEngineAdapter";
import { importMathLatex } from "./importer";
import { MathPalettePane } from "./MathPalettePane";
import { MathPreviewPane } from "./MathPreviewPane";
import { MathRawFallbackPane } from "./MathRawFallbackPane";
import { createInitialMathStructureSession, mathStructureReducer } from "./reducer";
import { MathStructureCanvas } from "./MathStructureCanvas";
import type { MathCanvasZoom } from "./types";

const CANVAS_ZOOMS: MathCanvasZoom[] = [100, 125, 150];

export const MathStructureDialog = ({
  sessionId,
  blockIndex,
  initialLatex,
  onClose,
  onLiveSync,
  dialogRef,
}: {
  sessionId: string;
  blockIndex: number;
  initialLatex: string;
  onClose: (result: "apply" | "cancel") => void;
  onLiveSync: (latex: string, options: { mergeKey: string }) => void;
  dialogRef?: { current: HTMLDivElement | null };
}) => {
  const [state, dispatch] = useReducer(
    mathStructureReducer,
    createInitialMathStructureSession(sessionId, blockIndex, initialLatex),
  );
  const lastSyncedRef = useRef<string | null>(null);
  const engineStatus = useMemo(() => getComputeEngineAdapterStatus(), []);

  useEffect(() => {
    const nextLatex = state.mode === "structured" ? state.lastValidLatex : state.rawLatexDraft;
    if (lastSyncedRef.current === nextLatex) {
      return;
    }
    lastSyncedRef.current = nextLatex;
    onLiveSync(nextLatex, { mergeKey: `math-session:${sessionId}` });
  }, [onLiveSync, sessionId, state.lastValidLatex, state.mode, state.rawLatexDraft]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      onClose("cancel");
    };

    window.addEventListener("keydown", handleWindowKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
    };
  }, [onClose]);

  return (
    <ModalShell
      isOpen
      title="Structural Math Toolbox"
      onClose={() => onClose("cancel")}
      className="markdown-hybrid-structural-math-dialog markdown-hybrid-structural-math-dialog-panel"
      bodyClassName="markdown-hybrid-structural-math-dialog-body"
      panelRef={dialogRef}
      initialFocusSelector={
        state.mode === "structured"
          ? ".markdown-hybrid-structural-math-canvas"
          : ".markdown-hybrid-structural-math-raw-textarea"
      }
      headerActions={
        state.mode === "structured" ? (
          <label className="markdown-hybrid-structural-math-zoom-control">
            <span>Zoom</span>
            <select
              className="text-input"
              aria-label="Canvas zoom"
              value={state.canvasZoom}
              onChange={(event) =>
                dispatch({
                  type: "setCanvasZoom",
                  zoom: Number(event.currentTarget.value) as MathCanvasZoom,
                })
              }
            >
              {CANVAS_ZOOMS.map((zoom) => (
                <option key={zoom} value={zoom}>
                  {zoom}%
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
    >
      <div className="markdown-hybrid-structural-math-dialog-meta" role="status">
        {engineStatus.reason}
      </div>

      {state.mode === "structured" ? (
        <>
          <MathPalettePane
            onTemplateSelect={(templateId) => dispatch({ type: "insertTemplate", templateId })}
          />
          <div className="markdown-hybrid-structural-math-layout">
            <MathStructureCanvas state={state} onDispatch={dispatch} />
            <MathPreviewPane latex={state.previewLatex} />
          </div>
        </>
      ) : (
        <MathRawFallbackPane
          value={state.rawLatexDraft}
          reason={state.importError}
          onChange={(value) => {
            const next = importMathLatex(value);
            if (next.mode === "structured") {
              dispatch({ type: "switchToStructured", ast: next.ast, latex: next.rawLatex });
              return;
            }
            dispatch({ type: "setRawLatex", value });
          }}
        />
      )}

      <div className="markdown-hybrid-structural-math-dialog-footer">
        <div className="markdown-hybrid-structural-math-dialog-footer-actions">
          <button
            type="button"
            className="ghost small"
            onClick={() => dispatch({ type: "revertSession" })}
          >
            Reset
          </button>
          {state.mode === "structured" ? (
            <button
              type="button"
              className="ghost small"
              onClick={() =>
                dispatch({
                  type: "switchToRaw",
                  reason: "Opened in raw LaTeX mode.",
                })
              }
            >
              Raw mode
            </button>
          ) : null}
        </div>
        <div className="markdown-hybrid-structural-math-dialog-footer-actions">
          <button type="button" className="ghost small" onClick={() => onClose("cancel")}>
            Cancel
          </button>
          <button type="button" className="primary small" onClick={() => onClose("apply")}>
            Apply
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
