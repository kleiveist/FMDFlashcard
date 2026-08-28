import { useCallback, useMemo, useRef, useState } from "react";
import {
  CanvasEditor,
  type CanvasEditorHandle,
  type PersistCanvasResult,
} from "./CanvasEditor";
import {
  CanvasDeleteConfirmDialog,
  CanvasExitFullscreenIcon,
  CanvasFitIcon,
  CanvasFullscreenIcon,
  CanvasIconButton,
  CanvasTrashIcon,
} from "./CanvasToolbar";
import type { CanvasCustomColorSlot } from "./canvasSettings";
import {
  parseMarkdownCanvasBlock,
  replaceMarkdownCanvasBlockSource,
} from "./markdownBlockSyntax";

type CanvasEmbeddedBlockProps = {
  raw: string;
  blockIndex?: number;
  allowEditing?: boolean;
  canvasCustomColors?: CanvasCustomColorSlot[];
  onCanvasCustomColorsChange?: (nextSlots: CanvasCustomColorSlot[]) => void;
  onCommitRaw?: (nextRaw: string) => void;
};

export const CanvasEmbeddedBlock = ({
  raw,
  blockIndex,
  allowEditing = false,
  canvasCustomColors,
  onCanvasCustomColorsChange,
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
        canvasCustomColors={canvasCustomColors}
        onCanvasCustomColorsChange={onCanvasCustomColorsChange}
        toolbarActions={
          <>
            <CanvasIconButton
              label="Fit canvas"
              onClick={() => editorRef.current?.fitToContent()}
              disabled={!parsed.ok}
            >
              <CanvasFitIcon />
            </CanvasIconButton>
            <CanvasIconButton
              label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setFullscreen((current) => !current)}
            >
              {fullscreen ? <CanvasExitFullscreenIcon /> : <CanvasFullscreenIcon />}
            </CanvasIconButton>
            <CanvasIconButton
              label="Delete canvas block"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={!allowEditing || !onCommitRaw}
            >
              <CanvasTrashIcon />
            </CanvasIconButton>
          </>
        }
        onPersistSource={persistSource}
      />

      {parsed.ok ? null : (
        <div className="error canvas-embedded-error">{parsed.error}</div>
      )}

      <CanvasDeleteConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Canvas loeschen?"
        description="Dieser Canvas-Block wird aus der Markdown-Datei entfernt. Diese Aktion kann nicht automatisch rueckgaengig gemacht werden."
        confirmLabel="Canvas loeschen"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
