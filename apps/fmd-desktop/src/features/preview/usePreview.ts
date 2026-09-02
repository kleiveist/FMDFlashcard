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

export type PreviewEditorMode = "code" | "markdown" | "hybrid";

const resolveDefaultEditEnabledForEditorMode = (editorMode: PreviewEditorMode) =>
  editorMode !== "markdown";

const normalizeEditEnabledForEditorMode = (editorMode: PreviewEditorMode, editEnabled: boolean) =>
  editorMode === "hybrid" ? true : Boolean(editEnabled);

export type PreviewSnapshot = {
  selectedFile: VaultFile | null;
  selectedFileOpenInNewTab: boolean;
  preview: string;
  previewState: LoadState;
  previewError: string;
  editorMode: PreviewEditorMode;
  editEnabled: boolean;
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
  const [editorMode, setEditorModeState] = useState<PreviewEditorMode>("markdown");
  const [editEnabled, setEditEnabledState] = useState(
    resolveDefaultEditEnabledForEditorMode("markdown"),
  );
  const editorModeRef = useRef<PreviewEditorMode>("markdown");
  const selectRequestIdRef = useRef(0);

  const takeSnapshot = useCallback(
    (): PreviewSnapshot => ({
      selectedFile,
      selectedFileOpenInNewTab,
      preview,
      previewState,
      previewError,
      editorMode,
      editEnabled,
    }),
    [
      editEnabled,
      editorMode,
      preview,
      previewError,
      previewState,
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
    editorModeRef.current = snapshot.editorMode;
    setEditorModeState(snapshot.editorMode);
    setEditEnabledState(
      normalizeEditEnabledForEditorMode(snapshot.editorMode, snapshot.editEnabled),
    );
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

  const setEditorMode = useCallback(
    (value: PreviewEditorMode | ((current: PreviewEditorMode) => PreviewEditorMode)) => {
      setEditorModeState((current) => {
        const nextMode = typeof value === "function" ? value(current) : value;
        editorModeRef.current = nextMode;
        setEditEnabledState((currentEditEnabled) =>
          normalizeEditEnabledForEditorMode(nextMode, currentEditEnabled),
        );
        return nextMode;
      });
    },
    [],
  );

  const setEditorModeWithDefaults = useCallback((nextMode: PreviewEditorMode) => {
    editorModeRef.current = nextMode;
    setEditorModeState(nextMode);
    setEditEnabledState(resolveDefaultEditEnabledForEditorMode(nextMode));
  }, []);

  const setEditEnabled = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    setEditEnabledState((current) => {
      const nextEditEnabled = typeof value === "function" ? value(current) : value;
      return normalizeEditEnabledForEditorMode(editorModeRef.current, nextEditEnabled);
    });
  }, []);

  return {
    editEnabled,
    editorMode,
    preview,
    previewError,
    previewState,
    resetPreview,
    restoreSnapshot,
    selectFile,
    selectedFile,
    selectedFileOpenInNewTab,
    setEditEnabled,
    setEditorMode,
    setEditorModeWithDefaults,
    setPreview,
    setPreviewError,
    setPreviewState,
    takeSnapshot,
  };
};
