import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";
import { CanvasEditor, type PersistCanvasResult } from "../features/canvas/CanvasEditor";
import type { CanvasCustomColorSlot } from "../features/canvas/canvasSettings";

type CanvasPanelProps = {
  selectedFile: VaultFile | null;
  preview: string;
  previewState: LoadState;
  previewError: string;
  canvasCustomColors?: CanvasCustomColorSlot[];
  onCanvasCustomColorsChange?: (nextSlots: CanvasCustomColorSlot[]) => void;
  onPersistSource: (nextSource: string) => Promise<PersistCanvasResult>;
};

export const CanvasPanel = ({
  selectedFile,
  preview,
  previewState,
  previewError,
  canvasCustomColors,
  onCanvasCustomColorsChange,
  onPersistSource,
}: CanvasPanelProps) => (
  <CanvasEditor
    source={preview}
    sourceKey={selectedFile?.path ?? null}
    sourceState={previewState}
    sourceError={previewError}
    title="Canvas"
    subtitle={selectedFile?.relative_path ?? "No file selected"}
    canEditSource={Boolean(selectedFile)}
    showModeToggle
    canvasCustomColors={canvasCustomColors}
    onCanvasCustomColorsChange={onCanvasCustomColorsChange}
    onPersistSource={onPersistSource}
  />
);
