/**
 * @file apps/fmd-desktop/src/features/vault/useVault.ts
 *
 * Zweck:
 * - Stellt den Hook useVault fuer Vault bereit.
 *
 * Verantwortlichkeiten:
 * - Verwaltet State und Ableitungen fuer Vault.
 * - Stellt Aktionen und Handler fuer die UI bereit.
 * - Bietet konsolidierte Daten fuer Komponenten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/errors.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - useVault: Hook fuer Vault.
 *
 * Hinweise:
 * - Hook darf nur innerhalb von React-Komponenten genutzt werden.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile, type VaultPngAsset } from "../../lib/tree";

type VaultScanResults = {
  files: VaultFile[];
  folders: string[];
  png_assets?: VaultPngAsset[];
};

type LoadOptions = {
  persist: boolean;
  clearOnFailure?: boolean;
  errorMessage?: string;
};

type PickOptions = {
  errorMessage?: string;
  onBeforeLoad?: () => void;
  onLoadFailed?: () => void;
};

export type VaultSnapshot = {
  vaultPath: string | null;
  files: VaultFile[];
  pngAssets: VaultPngAsset[];
  folders: string[];
  listState: LoadState;
  listError: string;
  lastRefreshAt: string | null;
};

type UseVaultOptions = {
  persistSettings: (updates: { vaultPath?: string | null }) => Promise<boolean>;
  showHiddenFolders: boolean;
};

export const useVault = ({ persistSettings, showHiddenFolders }: UseVaultOptions) => {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [pngAssets, setPngAssets] = useState<VaultPngAsset[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [listError, setListError] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const lastRescanHiddenState = useRef(showHiddenFolders);

  const takeSnapshot = useCallback(
    (): VaultSnapshot => ({
      vaultPath,
      files,
      pngAssets,
      folders,
      listState,
      listError,
      lastRefreshAt,
    }),
    [files, folders, lastRefreshAt, listError, listState, pngAssets, vaultPath],
  );

  const restoreSnapshot = useCallback((snapshot: VaultSnapshot) => {
    setVaultPath(snapshot.vaultPath);
    setFiles(snapshot.files);
    setPngAssets(snapshot.pngAssets);
    setFolders(snapshot.folders);
    setListState(snapshot.listState);
    setListError(snapshot.listError);
    setLastRefreshAt(snapshot.lastRefreshAt);
  }, []);

  const loadVault = useCallback(
    async (path: string, options: LoadOptions): Promise<VaultScanResults | null> => {
      setListError("");
      setVaultPath(path);
      setFiles([]);
      setPngAssets([]);
      setFolders([]);
      setListState("loading");
      try {
        const results = await invoke<VaultScanResults>("list_vault_entries", {
          vaultPath: path,
          showHiddenFolders,
        });
        setFiles(results.files);
        setPngAssets(results.png_assets ?? []);
        setFolders(results.folders);
        setLastRefreshAt(new Date().toISOString());
        setListState("idle");
        if (options.persist) {
          await persistSettings({ vaultPath: path });
        }
        return results;
      } catch (error) {
        const message = asErrorMessage(error, "Failed to list vault entries.");
        setListError(options.errorMessage ?? message);
        setListState("error");
        if (options.clearOnFailure) {
          setVaultPath(null);
          await persistSettings({ vaultPath: null });
        }
        return null;
      }
    },
    [persistSettings, showHiddenFolders],
  );

  const pickVault = useCallback(
    async (options?: PickOptions): Promise<VaultScanResults | null> => {
      setListError("");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Vault auswaehlen",
      });

      if (!selected || Array.isArray(selected)) {
        return null;
      }

      const snapshot = takeSnapshot();
      options?.onBeforeLoad?.();

      const errorMessage =
        options?.errorMessage ?? "Ausgewaehlter Vault ist nicht verfuegbar.";
      const results = await loadVault(selected, {
        persist: true,
        clearOnFailure: false,
        errorMessage,
      });

      if (!results) {
        restoreSnapshot(snapshot);
        setListError(errorMessage);
        options?.onLoadFailed?.();
      }

      return results;
    },
    [loadVault, restoreSnapshot, takeSnapshot],
  );

  const rescanVault = useCallback(async (): Promise<boolean> => {
    if (!vaultPath || listState === "loading") {
      return false;
    }
    setListError("");
    setListState("loading");
    try {
      const results = await invoke<VaultScanResults>("list_vault_entries", {
        vaultPath,
        showHiddenFolders,
      });
      setFiles(results.files);
      setPngAssets(results.png_assets ?? []);
      setFolders(results.folders);
      setLastRefreshAt(new Date().toISOString());
      setListState("idle");
      return true;
    } catch (error) {
      const message = asErrorMessage(error, "Vault konnte nicht neu gescannt werden.");
      setListError(message);
      setListState("error");
      return false;
    }
  }, [listState, showHiddenFolders, vaultPath]);

  useEffect(() => {
    if (!vaultPath || listState === "loading") {
      return;
    }
    if (lastRescanHiddenState.current === showHiddenFolders) {
      return;
    }
    lastRescanHiddenState.current = showHiddenFolders;
    void rescanVault();
  }, [listState, rescanVault, showHiddenFolders, vaultPath]);

  return {
    files,
    pngAssets,
    folders,
    listError,
    listState,
    lastRefreshAt,
    loadVault,
    pickVault,
    rescanVault,
    restoreSnapshot,
    setFiles,
    setPngAssets,
    setFolders,
    setListError,
    setListState,
    setLastRefreshAt,
    setVaultPath,
    takeSnapshot,
    vaultPath,
  };
};
