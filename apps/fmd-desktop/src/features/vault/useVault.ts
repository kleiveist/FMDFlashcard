import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile } from "../../lib/tree";

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
  listState: LoadState;
  listError: string;
};

type UseVaultOptions = {
  persistSettings: (updates: { vaultPath?: string | null }) => Promise<boolean>;
};

export const useVault = ({ persistSettings }: UseVaultOptions) => {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [listError, setListError] = useState("");

  const takeSnapshot = useCallback(
    (): VaultSnapshot => ({
      vaultPath,
      files,
      listState,
      listError,
    }),
    [files, listError, listState, vaultPath],
  );

  const restoreSnapshot = useCallback((snapshot: VaultSnapshot) => {
    setVaultPath(snapshot.vaultPath);
    setFiles(snapshot.files);
    setListState(snapshot.listState);
    setListError(snapshot.listError);
  }, []);

  const loadVault = useCallback(
    async (path: string, options: LoadOptions): Promise<VaultFile[] | null> => {
      setListError("");
      setVaultPath(path);
      setFiles([]);
      setListState("loading");
      try {
        const results = await invoke<VaultFile[]>("list_markdown_files", {
          vaultPath: path,
        });
        setFiles(results);
        setListState("idle");
        if (options.persist) {
          await persistSettings({ vaultPath: path });
        }
        return results;
      } catch (error) {
        const message = asErrorMessage(error, "Failed to list markdown files.");
        setListError(options.errorMessage ?? message);
        setListState("error");
        if (options.clearOnFailure) {
          setVaultPath(null);
          await persistSettings({ vaultPath: null });
        }
        return null;
      }
    },
    [persistSettings],
  );

  const pickVault = useCallback(
    async (options?: PickOptions): Promise<VaultFile[] | null> => {
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

  const rescanVault = useCallback(async () => {
    if (!vaultPath || listState === "loading") {
      return;
    }
    setListError("");
    setListState("loading");
    try {
      const results = await invoke<VaultFile[]>("list_markdown_files", {
        vaultPath,
      });
      setFiles(results);
      setListState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Vault konnte nicht neu gescannt werden.");
      setListError(message);
      setListState("error");
    }
  }, [listState, vaultPath]);

  return {
    files,
    listError,
    listState,
    loadVault,
    pickVault,
    rescanVault,
    restoreSnapshot,
    setFiles,
    setListError,
    setListState,
    setVaultPath,
    takeSnapshot,
    vaultPath,
  };
};
