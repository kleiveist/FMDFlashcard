import { useCallback, useMemo, useRef, useState } from "react";
import { ModalShell } from "../../components/ModalShell";
import {
  CanvasEditor,
  type CanvasEditorHandle,
  type PersistCanvasResult,
} from "./CanvasEditor";
import {
  parseMarkdownCanvasBlock,
  replaceMarkdownCanvasBlockSource,
} from "./markdownBlockSyntax";

type CanvasEmbeddedBlockProps = {
  raw: string;
  blockIndex?: number;
  allowEditing?: boolean;
  onCommitRaw?: (nextRaw: string) => void;
};

export const CanvasEmbeddedBlock = ({
  raw,
  blockIndex,
  allowEditing = false,
  onCommitRaw,
}: CanvasEmbeddedBlockProps) => {
  const editorRef = useRef<CanvasEditorHandle | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const parsed = useMemo(() => parseMarkdownCanvasBlock(raw), [raw]);
  const source = parsed.ok ? parsed.block.source : parsed.block?.source ?? raw;
  const canEditBlock = allowEditing && parsed.ok && Boolean(onCommitRaw);
  const sourceKey =
    typeof blockIndex === "number"
      ? `markdown-canvas-${blockIndex}`
      : "markdown-canvas-standalone";

  const persistSource = useCallback(
    async (nextSource: string): Promise<PersistCanvasResult> => {
      if (!onCommitRaw) {
        return { ok: false, error: "Canvas block could not be saved." };
      }
      onCommitRaw(replaceMarkdownCanvasBlockSource(raw, nextSource));
      return { ok: true };
    },
    [onCommitRaw, raw],
  );

  const confirmDelete = useCallback(() => {
    setDeleteConfirmOpen(false);
    onCommitRaw?.("");
  }, [onCommitRaw]);

  return (
    <div
      className={`canvas-embedded-block${fullscreen ? " is-fullscreen" : ""}`}
      data-md-block-control="true"
      data-md-canvas-block-index={typeof blockIndex === "number" ? blockIndex : undefined}
      contentEditable={false}
    >
      <CanvasEditor
        ref={editorRef}
        source={source}
        sourceKey={sourceKey}
        title="Canvas"
        subtitle="Markdown block"
        canEditSource={canEditBlock}
        showModeToggle={false}
        forcedMode={canEditBlock ? "edit" : "view"}
        className="canvas-embedded-editor"
        bodyClassName="canvas-embedded-editor-body"
        toolbarActions={
          <>
            <button
              type="button"
              className="ghost small"
              onClick={() => editorRef.current?.fitToContent()}
              disabled={!parsed.ok}
            >
              Fit
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => setFullscreen((current) => !current)}
            >
              {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={!allowEditing || !onCommitRaw}
            >
              Delete
            </button>
          </>
        }
        onPersistSource={persistSource}
      />

      {parsed.ok ? null : (
        <div className="error canvas-embedded-error">{parsed.error}</div>
      )}

      <ModalShell
        isOpen={deleteConfirmOpen}
        title="Canvas loeschen?"
        onClose={() => setDeleteConfirmOpen(false)}
        className="canvas-delete-confirm-modal"
        bodyClassName="modal-body"
        initialFocusSelector="[data-canvas-delete-cancel]"
      >
        <p>Dieser Canvas-Block wird aus der Markdown-Datei entfernt.</p>
        <p className="muted">
          Diese Aktion kann nicht automatisch rueckgaengig gemacht werden.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="ghost small"
            data-canvas-delete-cancel
            onClick={() => setDeleteConfirmOpen(false)}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="ghost small danger"
            onClick={confirmDelete}
          >
            Canvas loeschen
          </button>
        </div>
      </ModalShell>
    </div>
  );
};
