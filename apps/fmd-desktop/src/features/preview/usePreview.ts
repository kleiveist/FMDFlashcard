/**
 * @file apps/fmd-desktop/src/features/preview/usePreview.ts
 *
 * Zweck:
 * - Stellt den Hook usePreview fuer Preview bereit.
 *
 * Verantwortlichkeiten:
 * - Verwaltet State und Ableitungen fuer Preview.
 * - Stellt Aktionen und Handler fuer die UI bereit.
 * - Bietet konsolidierte Daten fuer Komponenten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/errors.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - usePreview: Hook fuer Preview.
 *
 * Hinweise:
 * - Hook darf nur innerhalb von React-Komponenten genutzt werden.
 */

import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile } from "../../lib/tree";

export type PreviewSnapshot = {
  selectedFile: VaultFile | null;
  selectedFileOpenInNewTab: boolean;
  preview: string;
  previewState: LoadState;
  previewError: string;
  rawPreview: boolean;
};

export type PreviewFileOpenOptions = {
  openInNewTab?: boolean;
};

export const usePreview = () => {
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [selectedFileOpenInNewTab, setSelectedFileOpenInNewTab] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [previewError, setPreviewError] = useState("");
  const [rawPreview, setRawPreview] = useState(false);
  const selectRequestIdRef = useRef(0);

  const takeSnapshot = useCallback(
    (): PreviewSnapshot => ({
      selectedFile,
      selectedFileOpenInNewTab,
      preview,
      previewState,
      previewError,
      rawPreview,
    }),
    [
      preview,
      previewError,
      previewState,
      rawPreview,
      selectedFile,
      selectedFileOpenInNewTab,
    ],
  );

  const restoreSnapshot = useCallback((snapshot: PreviewSnapshot) => {
    selectRequestIdRef.current += 1;
    setSelectedFile(snapshot.selectedFile);
    setSelectedFileOpenInNewTab(Boolean(snapshot.selectedFileOpenInNewTab));
    setPreview(snapshot.preview);
    setPreviewState(snapshot.previewState);
    setPreviewError(snapshot.previewError);
    setRawPreview(snapshot.rawPreview);
  }, []);

  const resetPreview = useCallback(() => {
    selectRequestIdRef.current += 1;
    setSelectedFile(null);
    setSelectedFileOpenInNewTab(false);
    setPreview("");
    setPreviewState("idle");
    setPreviewError("");
  }, []);

  const selectFile = useCallback(async (file: VaultFile, options?: PreviewFileOpenOptions) => {
    selectRequestIdRef.current += 1;
    const requestId = selectRequestIdRef.current;
    setSelectedFile(file);
    setSelectedFileOpenInNewTab(Boolean(options?.openInNewTab));
    setPreview("");
    setPreviewError("");
    setPreviewState("loading");
    try {
      const contents = await invoke<string>("read_text_file", {
        path: file.path,
      });
      if (requestId !== selectRequestIdRef.current) {
        return;
      }
      setPreview(contents);
      setPreviewState("idle");
    } catch (error) {
      if (requestId !== selectRequestIdRef.current) {
        return;
      }
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
    selectedFileOpenInNewTab,
    setPreview,
    setPreviewError,
    setPreviewState,
    setRawPreview,
    takeSnapshot,
  };
};
