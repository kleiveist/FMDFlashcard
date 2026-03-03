import { useEffect, useMemo, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { getComputeEngineAdapterStatus } from "./computeEngineAdapter";
import { importMathLatex } from "./importer";
import { MathPalettePane } from "./MathPalettePane";
import { MathPreviewPane } from "./MathPreviewPane";
import { MathRawFallbackPane } from "./MathRawFallbackPane";
import { mathStructureReducer, createInitialMathStructureSession } from "./reducer";
import { MathStructureCanvas } from "./MathStructureCanvas";

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
  onClose: () => void;
  onLiveSync: (latex: string, options: { mergeKey: string }) => void;
  dialogRef?: { current: HTMLDivElement | null };
}) => {
  const [state, dispatch] = useReducer(
    mathStructureReducer,
    createInitialMathStructureSession(sessionId, blockIndex, initialLatex),
  );
  const localDialogRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const engineStatus = useMemo(() => getComputeEngineAdapterStatus(), []);

  useEffect(() => {
    const node = localDialogRef.current;
    if (!node) {
      return;
    }
    try {
      node.focus({ preventScroll: true });
    } catch {
      node.focus();
    }
  }, []);

  useEffect(() => {
    const nextLatex = state.mode === "structured" ? state.lastValidLatex : state.rawLatexDraft;
    if (lastSyncedRef.current === nextLatex) {
      return;
    }
    lastSyncedRef.current = nextLatex;
    onLiveSync(nextLatex, { mergeKey: `math-session:${sessionId}` });
  }, [onLiveSync, sessionId, state.lastValidLatex, state.mode, state.rawLatexDraft]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="markdown-hybrid-structural-math-dialog-backdrop"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={(node) => {
          localDialogRef.current = node;
          if (dialogRef) {
            dialogRef.current = node;
          }
        }}
        className="markdown-hybrid-structural-math-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Structural Math Toolbox"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="markdown-hybrid-structural-math-dialog-header">
          <div>
            <div className="markdown-hybrid-structural-math-dialog-title">Structural Math Toolbox</div>
            <div className="markdown-hybrid-structural-math-dialog-subtitle">
              {engineStatus.reason}
            </div>
          </div>
          <div className="markdown-hybrid-structural-math-dialog-actions">
            <button type="button" onClick={() => dispatch({ type: "revertSession" })}>
              Revert Session
            </button>
            {state.mode === "structured" ? (
              <button type="button" onClick={() => dispatch({ type: "switchToRaw", reason: "Opened in raw LaTeX mode." })}>
                Raw Mode
              </button>
            ) : null}
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </div>

        {state.mode === "structured" ? (
          <div className="markdown-hybrid-structural-math-layout">
            <MathPalettePane
              activeCategoryId={state.activeCategoryId}
              recentTemplateIds={state.recentTemplateIds}
              onCategoryChange={(categoryId) => dispatch({ type: "setActiveCategory", categoryId })}
              onTemplateSelect={(templateId) => dispatch({ type: "insertTemplate", templateId })}
            />
            <MathStructureCanvas state={state} onDispatch={dispatch} />
            <MathPreviewPane latex={state.previewLatex} />
          </div>
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
      </div>
    </div>,
    document.body,
  );
};
