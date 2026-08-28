/**
 * @file frontend/src/features/vault/useVaultPathInfo.ts
 *
 * Zweck:
 * - Stellt Pfad-Infos fuer Vaults bereit.
 */

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type VaultPathInfo = {
  exists: boolean;
  isDir: boolean;
};

export const useVaultPathInfo = (paths: string[], isActive: boolean) => {
  const [infoByPath, setInfoByPath] = useState<Record<string, VaultPathInfo>>({});
  const pathsKey = useMemo(() => paths.join("|"), [paths]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (paths.length === 0) {
        setInfoByPath({});
        return;
      }
      const entries = await Promise.all(
        paths.map(async (path) => {
          try {
            const info = await invoke<VaultPathInfo>("get_path_info", { path });
            return [path, info] as const;
          } catch {
            return [path, { exists: false, isDir: false }] as const;
          }
        }),
      );
      if (cancelled) {
        return;
      }
      const next: Record<string, VaultPathInfo> = {};
      entries.forEach(([path, info]) => {
        next[path] = info;
      });
      setInfoByPath(next);
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [isActive, paths, pathsKey]);

  return infoByPath;
};
