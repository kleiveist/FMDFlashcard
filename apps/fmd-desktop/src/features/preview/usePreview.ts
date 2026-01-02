import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile } from "../../lib/tree";

export type PreviewSnapshot = {
  selectedFile: VaultFile | null;
  preview: string;
  previewState: LoadState;
  previewError: string;
  rawPreview: boolean;
};

export const usePreview = () => {
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [preview, setPreview] = useState("");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [previewError, setPreviewError] = useState("");
  const [rawPreview, setRawPreview] = useState(false);

  const takeSnapshot = useCallback(
    (): PreviewSnapshot => ({
      selectedFile,
      preview,
      previewState,
      previewError,
      rawPreview,
    }),
    [preview, previewError, previewState, rawPreview, selectedFile],
  );

  const restoreSnapshot = useCallback((snapshot: PreviewSnapshot) => {
    setSelectedFile(snapshot.selectedFile);
    setPreview(snapshot.preview);
    setPreviewState(snapshot.previewState);
    setPreviewError(snapshot.previewError);
    setRawPreview(snapshot.rawPreview);
  }, []);

  const resetPreview = useCallback(() => {
    setSelectedFile(null);
    setPreview("");
    setPreviewState("idle");
    setPreviewError("");
  }, []);

  const selectFile = useCallback(async (file: VaultFile) => {
    setSelectedFile(file);
    setPreview("");
    setPreviewError("");
    setPreviewState("loading");
    try {
      const contents = await invoke<string>("read_text_file", {
        path: file.path,
      });
      setPreview(contents);
      setPreviewState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Failed to load file contents.");
      setPreviewError(message);
      setPreviewState("error");
    }
  }, []);

  return {
    preview,
    previewError,
    previewState,
    rawPreview,
    resetPreview,
    restoreSnapshot,
    selectFile,
    selectedFile,
    setPreview,
    setPreviewError,
    setPreviewState,
    setRawPreview,
    takeSnapshot,
  };
};
