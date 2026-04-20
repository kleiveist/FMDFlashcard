/**
 * @file apps/fmd-desktop/src/lib/tree.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Tree.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Tree bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/path.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

import { isHiddenPath, normalizeRelativePath } from "./path";
import { compareNaturalText } from "./naturalSort";

export type VaultFile = {
  path: string;
  relative_path: string;
  created_at?: number | null;
  last_modified?: number | null;
  size_bytes?: number | null;
};

export type VaultPngAsset = {
  path: string;
  relative_path: string;
  file_name: string;
  extension: "png";
  size_bytes?: number | null;
  last_modified?: number | null;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[];
  file?: VaultFile;
  fullPath?: string;
};

export const buildTree = (files: VaultFile[]): TreeNode[] => {
  const root: TreeNode = {
    name: "__root__",
    path: "",
    type: "dir",
    children: [],
  };

  for (const file of files) {
    const relative = normalizeRelativePath(file.relative_path);
    const parts = relative.split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }
    let current = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (isFile) {
        const existing = current.children?.find(
          (child) => child.type === "file" && child.path === currentPath,
        );
        if (!existing) {
          current.children = current.children ?? [];
          current.children.push({
            name: part,
            path: currentPath,
            type: "file",
            file,
            fullPath: file.path,
          });
        }
        return;
      }

      let next = current.children?.find(
        (child) => child.type === "dir" && child.name === part,
      );
      if (!next) {
        next = {
          name: part,
          path: currentPath,
          type: "dir",
          children: [],
        };
        current.children = current.children ?? [];
        current.children.push(next);
      }
      current = next;
    });
  }

  return sortNodes(root.children ?? []);
};

export const filterHiddenFiles = (
  files: VaultFile[],
  showHiddenFolders: boolean,
) => {
  if (showHiddenFolders) {
    return files;
  }
  return files.filter((file) => !isHiddenPath(file.relative_path));
};

export const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return compareNaturalText(a.name, b.name);
  });

  return sorted.map((node) => {
    if (node.type === "dir" && node.children) {
      return { ...node, children: sortNodes(node.children) };
    }
    return node;
  });
};
