/**
 * @file apps/fmd-desktop/src/components/VaultTree.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Vault Tree.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/icons.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/VaultCreateModal.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/lib/errors.ts: Hilfsfunktionen oder Typen.
 *
 * Exportiert:
 * - VaultTree: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { FileIcon, FolderIcon, RefreshIcon } from "./icons";
import { InlineRenameLabel } from "./InlineRenameLabel";
import { VaultCreateModal } from "./VaultCreateModal";
import { VaultDeleteModal } from "./VaultDeleteModal";
import { asErrorMessage } from "../lib/errors";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDrag,
  setDropEffectSafe,
  startInternalDrag,
} from "../lib/dragDrop";
import { isHiddenPath, normalizeRelativePath, vaultBaseName } from "../lib/path";
import {
  buildTree,
  filterHiddenFiles,
  sortNodes,
  type TreeNode,
  type VaultFile,
} from "../lib/tree";
import { type LoadState } from "../lib/types";
import { isEditableTarget } from "../lib/shortcuts/bindings";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";

const OVERFLOW_DEPTH = 4;
const DEFAULT_FILE_NAME = "New Note.md";
const DEFAULT_FOLDER_NAME = "New Folder";
const NAME_FORBIDDEN_PATTERN = /[\\/]/;
const MARKDOWN_FILE_PATTERN = /\.(md|markdown|mdx)$/i;

const isMarkdownFilePath = (value: string) => MARKDOWN_FILE_PATTERN.test(value);

type DeleteShortcutEvent = {
  key: string;
  currentTarget: { contains?: (node: Node | null) => boolean } | null;
  target: unknown;
};

type VaultTreeDragPayload =
  | {
      kind: "file";
      file: VaultFile;
    }
  | {
      kind: "dir";
      path: string;
      name: string;
    };

const asVaultTreeDragPayload = (value: unknown): VaultTreeDragPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<VaultTreeDragPayload>;
  if (candidate.kind === "file" && candidate.file && typeof candidate.file === "object") {
    return {
      kind: "file",
      file: candidate.file as VaultFile,
    };
  }
  if (
    candidate.kind === "dir" &&
    typeof candidate.path === "string" &&
    typeof candidate.name === "string"
  ) {
    return {
      kind: "dir",
      path: candidate.path,
      name: candidate.name,
    };
  }
  return null;
};

export const shouldHandleVaultDeleteShortcut = (
  event: DeleteShortcutEvent,
) => {
  if (event.key !== "Delete") {
    return false;
  }
  if (!event.currentTarget || !event.target) {
    return false;
  }
  if (typeof event.currentTarget.contains !== "function") {
    return false;
  }
  return event.currentTarget.contains(event.target as Node);
};

export const shouldHandleVaultRenameShortcut = (
  event: DeleteShortcutEvent,
) => {
  if (event.key !== "F2") {
    return false;
  }
  if (!event.currentTarget || !event.target) {
    return false;
  }
  if (typeof event.currentTarget.contains !== "function") {
    return false;
  }
  return event.currentTarget.contains(event.target as Node);
};

const getIndentVars = (depth: number): CSSProperties =>
  ({
    "--tree-depth": String(depth),
    "--tree-overflow-depth": String(Math.max(0, depth - OVERFLOW_DEPTH)),
  } as CSSProperties);

const getMaxDepth = (nodes: TreeNode[], depth: number): number => {
  let maxDepth = depth;
  for (const node of nodes) {
    if (node.type === "dir" && node.children?.length) {
      maxDepth = Math.max(maxDepth, getMaxDepth(node.children, depth + 1));
    } else {
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  return maxDepth;
};

const getParentRelativePath = (value: string) => {
  const normalized = normalizeRelativePath(value);
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return "";
  }
  return normalized.slice(0, lastSlash);
};

const normalizeFolderPath = (value: string) =>
  normalizeRelativePath(value).replace(/\/+$/, "");

const getFileName = (value: string) => {
  const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return normalized;
  }
  return normalized.slice(lastSlash + 1);
};

const isPathWithin = (value: string, parent: string) => {
  if (!parent) {
    return false;
  }
  return value === parent || value.startsWith(`${parent}/`);
};

const joinVaultPath = (vaultRoot: string, relativePath: string) => {
  const separator = vaultRoot.includes("\\") ? "\\" : "/";
  const trimmedRoot = vaultRoot.replace(/[\\/]+$/, "");
  const normalizedRelative = normalizeRelativePath(relativePath).replace(/\//g, separator);
  if (!normalizedRelative) {
    return trimmedRoot;
  }
  return `${trimmedRoot}${separator}${normalizedRelative}`;
};

const resolveNodePaths = (
  target: ContextMenuTarget,
  vaultRoot: string,
): ResolvedNodePaths => {
  if (target.kind === "file") {
    const relativeFilePath = normalizeRelativePath(target.file.relative_path);
    const fileAbsPath = joinVaultPath(vaultRoot, relativeFilePath);
    const folderRelativePath = getParentRelativePath(relativeFilePath);
    const folderAbsPath = joinVaultPath(vaultRoot, folderRelativePath);
    return {
      kind: "file",
      relativePath: relativeFilePath,
      fileAbsPath,
      folderAbsPath,
    };
  }
  const relativeFolderPath = normalizeRelativePath(target.path ?? "");
  return {
    kind: "dir",
    relativePath: relativeFolderPath,
    folderAbsPath: joinVaultPath(vaultRoot, relativeFolderPath),
  };
};

const findDirectoryNode = (nodes: TreeNode[], path: string): TreeNode | null => {
  if (!path) {
    return { name: "__root__", path: "", type: "dir", children: nodes };
  }
  const parts = normalizeRelativePath(path).split("/").filter(Boolean);
  let current: TreeNode | null = { name: "__root__", path: "", type: "dir", children: nodes };
  let currentPath = "";
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const next: TreeNode | null =
      current?.children?.find(
        (child) => child.type === "dir" && child.path === currentPath,
      ) ?? null;
    if (!next) {
      return null;
    }
    current = next;
  }
  return current;
};

const getChildNameSet = (nodes: TreeNode[], path: string) => {
  const names = new Set<string>();
  const node = findDirectoryNode(nodes, path);
  if (!node?.children) {
    return names;
  }
  node.children.forEach((child) => {
    names.add(child.name.trim().toLowerCase());
  });
  return names;
};

const normalizeNewName = (value: string) => value.trim();

const ensureMarkdownExtension = (value: string) =>
  /\.md$/i.test(value) ? value : `${value}.md`;

const ensureUniqueName = (
  value: string,
  existing: Set<string>,
  kind: "file" | "folder",
) => {
  const trimmed = normalizeNewName(value);
  const base = kind === "file" ? trimmed.replace(/\.md$/i, "") : trimmed;
  const extension = kind === "file" ? ".md" : "";
  let candidate = kind === "file" ? ensureMarkdownExtension(trimmed) : trimmed;
  let index = 2;
  while (existing.has(candidate.toLowerCase())) {
    candidate = `${base} (${index})${extension}`;
    index += 1;
  }
  return candidate;
};

type VaultDeleteHandlerOptions = {
  vaultPath: string | null;
  deleteTarget: VaultFile | null;
  selectedFile: VaultFile | null;
  isDeleting: boolean;
  invokeDelete: (vaultPath: string, relativePath: string) => Promise<void>;
  onRescanVault: (source?: string) => Promise<boolean>;
  onClose: () => void;
  onClearSelection?: () => void;
  setError: (message: string) => void;
  setIsDeleting: (value: boolean) => void;
};

export const buildVaultDeleteHandlers = (options: VaultDeleteHandlerOptions) => {
  const handleCancel = () => {
    if (options.isDeleting) {
      return;
    }
    options.onClose();
  };

  const handleConfirm = async () => {
    if (options.isDeleting || !options.vaultPath || !options.deleteTarget) {
      return;
    }
    if (!isMarkdownFilePath(options.deleteTarget.relative_path)) {
      options.setError("Only markdown files can be deleted.");
      return;
    }
    options.setIsDeleting(true);
    options.setError("");
    try {
      await options.invokeDelete(
        options.vaultPath,
        options.deleteTarget.relative_path,
      );
      options.onRescanVault();
      if (options.selectedFile?.path === options.deleteTarget.path) {
        options.onClearSelection?.();
      }
      options.onClose();
    } catch (error) {
      options.setError(asErrorMessage(error, "Failed to delete file."));
    } finally {
      options.setIsDeleting(false);
    }
  };

  return { handleCancel, handleConfirm };
};

type ContextMenuTarget =
  | { kind: "file"; file: VaultFile; dirPath: string }
  | { kind: "dir"; path: string }
  | { kind: "empty"; path: string };

type SelectedNode =
  | { kind: "file"; file: VaultFile }
  | { kind: "dir"; path: string }
  | null;

type DraggedNode =
  | { kind: "file"; file: VaultFile }
  | { kind: "dir"; path: string; name: string };

type PathInfo = {
  exists: boolean;
  isDir: boolean;
};

type ResolvedNodePaths = {
  kind: "file" | "dir";
  relativePath: string;
  fileAbsPath?: string;
  folderAbsPath: string;
};

type VaultTreeProps = {
  activeFolderPath: string | null;
  expandedPaths: Set<string>;
  fileCountLabel: string;
  files: VaultFile[];
  folders: string[];
  showHiddenFolders: boolean;
  showEmptyFolders: boolean;
  listError: string;
  listState: LoadState;
  refreshLabel?: string;
  onRescanVault: (source?: string) => Promise<boolean>;
  onActiveFolderChange: (path: string | null) => void;
  onTogglePath: (path: string, isOpen: boolean) => void;
  onSelectFile: (
    file: VaultFile,
    options?: {
      openInNewTab?: boolean;
    },
  ) => void;
  onClearSelection?: () => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const VaultTree = ({
  activeFolderPath,
  expandedPaths,
  fileCountLabel,
  files,
  folders,
  showHiddenFolders,
  showEmptyFolders,
  listError,
  listState,
  refreshLabel,
  onRescanVault,
  onActiveFolderChange,
  onTogglePath,
  onSelectFile,
  onClearSelection,
  selectedFile,
  vaultPath,
}: VaultTreeProps) => {
  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const isRescanningVault = listState === "loading";
  const refreshTitle = refreshLabel ?? "Rescan vault";
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  const [extraDirs, setExtraDirs] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<VaultFile[]>([]);
  const [pendingFileRemovals, setPendingFileRemovals] = useState<string[]>([]);
  const [pendingDirRemovals, setPendingDirRemovals] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    target: ContextMenuTarget;
    x: number;
    y: number;
  } | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [createKind, setCreateKind] = useState<"file" | "folder" | null>(null);
  const [createDirPath, setCreateDirPath] = useState("");
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [openError, setOpenError] = useState("");
  const [moveError, setMoveError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultFile | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [deleteFolderError, setDeleteFolderError] = useState("");
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(null);
  const [renameTarget, setRenameTarget] = useState<{
    kind: "file" | "dir";
    path: string;
    parentPath: string;
    name: string;
  } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameRange, setRenameRange] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [draggedNode, setDraggedNode] = useState<DraggedNode | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [dragOverState, setDragOverState] = useState<"valid" | "invalid" | null>(
    null,
  );
  const portalTarget = typeof document === "undefined" ? null : document.body;


  const mergedFiles = useMemo(() => {
    if (pendingFiles.length === 0) {
      return files;
    }
    const knownPaths = new Set(files.map((file) => file.path));
    const next = [...files];
    pendingFiles.forEach((file) => {
      if (!knownPaths.has(file.path)) {
        next.push(file);
      }
    });
    return next;
  }, [files, pendingFiles]);

  const normalizedRemovedFiles = useMemo(
    () => new Set(pendingFileRemovals.map((path) => normalizeRelativePath(path))),
    [pendingFileRemovals],
  );
  const normalizedRemovedDirs = useMemo(
    () =>
      pendingDirRemovals
        .map((path) => normalizeFolderPath(path))
        .filter(Boolean),
    [pendingDirRemovals],
  );
  const isRemovedDirPath = useCallback(
    (path: string) => {
      const normalized = normalizeFolderPath(path);
      if (!normalized) {
        return false;
      }
      return normalizedRemovedDirs.some((removed) => isPathWithin(normalized, removed));
    },
    [normalizedRemovedDirs],
  );
  const filteredFiles = useMemo(() => {
    if (normalizedRemovedFiles.size === 0 && normalizedRemovedDirs.length === 0) {
      return mergedFiles;
    }
    return mergedFiles.filter((file) => {
      const relative = normalizeRelativePath(file.relative_path);
      if (normalizedRemovedFiles.has(relative)) {
        return false;
      }
      if (normalizedRemovedDirs.length === 0) {
        return true;
      }
      return !normalizedRemovedDirs.some((dir) => isPathWithin(relative, dir));
    });
  }, [mergedFiles, normalizedRemovedDirs, normalizedRemovedFiles]);

  const visibleFiles = useMemo(
    () => filterHiddenFiles(filteredFiles, showHiddenFolders),
    [filteredFiles, showHiddenFolders],
  );

  const treeNodes = useMemo(() => {
    const nodes = buildTree(visibleFiles);
    const visibleExtraDirs = showEmptyFolders
      ? showHiddenFolders
        ? extraDirs
        : extraDirs.filter((dirPath) => !isHiddenPath(dirPath))
      : [];
    const visibleFolders =
      showEmptyFolders
        ? showHiddenFolders
          ? folders
          : folders.filter((dirPath) => !isHiddenPath(dirPath))
        : [];
    const filteredExtraDirs = visibleExtraDirs.filter(
      (dirPath) => !isRemovedDirPath(dirPath),
    );
    const filteredFolders = visibleFolders.filter(
      (dirPath) => !isRemovedDirPath(dirPath),
    );
    const combinedDirs = new Set<string>();
    [...filteredExtraDirs, ...filteredFolders].forEach((dirPath) => {
      const normalized = normalizeRelativePath(dirPath);
      if (!normalized) {
        return;
      }
      combinedDirs.add(normalized);
    });
    if (combinedDirs.size === 0) {
      return nodes;
    }
    const nextNodes = [...nodes];
    combinedDirs.forEach((dirPath) => {
      const parts = dirPath.split("/").filter(Boolean);
      let currentNodes = nextNodes;
      let currentPath = "";
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let existing = currentNodes.find(
          (node) => node.type === "dir" && node.name === part,
        );
        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: "dir",
            children: [],
          };
          currentNodes.push(existing);
        }
        if (existing.type !== "dir") {
          break;
        }
        existing.children = existing.children ?? [];
        currentNodes = existing.children;
      }
    });
    return sortNodes(nextNodes);
  }, [
    extraDirs,
    folders,
    isRemovedDirPath,
    showEmptyFolders,
    showHiddenFolders,
    visibleFiles,
  ]);
  const maxDepth = useMemo(
    () => (treeNodes.length ? getMaxDepth(treeNodes, 1) : 0),
    [treeNodes],
  );
  const hasDeepIndent = maxDepth > OVERFLOW_DEPTH;
  const normalizedActiveFolderPath = useMemo(
    () => normalizeRelativePath(activeFolderPath ?? "").replace(/\/+$/, ""),
    [activeFolderPath],
  );

  const getFolderState = useCallback(
    (path: string) => {
      const normalizedPath = normalizeRelativePath(path).replace(/\/+$/, "");
      const isActiveFolder = normalizedPath === normalizedActiveFolderPath;
      const isBreadcrumb =
        normalizedActiveFolderPath !== "" &&
        (normalizedPath === "" ||
          normalizedActiveFolderPath.startsWith(`${normalizedPath}/`));
      return {
        isActiveFolder,
        isBreadcrumb: isBreadcrumb && !isActiveFolder,
      };
    },
    [normalizedActiveFolderPath],
  );


  useEffect(() => {
    setExtraDirs([]);
    setPendingFiles([]);
    setPendingFileRemovals([]);
    setPendingDirRemovals([]);
    setOpenError("");
    setMoveError("");
    setStatusMessage("");
    setDeleteTarget(null);
    setDeleteError("");
    setIsDeleting(false);
    setDeleteFolderTarget(null);
    setDeleteFolderError("");
    setIsDeletingFolder(false);
    setSelectedNode(null);
    setRenameTarget(null);
    setRenameDraft("");
    setRenameError("");
    setRenameRange(null);
    setIsRenaming(false);
    setDraggedNode(null);
    setDragOverPath(null);
    setDragOverState(null);
    onActiveFolderChange(null);
    setContextMenu(null);
  }, [onActiveFolderChange, vaultPath]);

  useEffect(() => {
    setPendingFiles((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const knownPaths = new Set(files.map((file) => file.path));
      const next = prev.filter((file) => !knownPaths.has(file.path));
      return next.length === prev.length ? prev : next;
    });
  }, [files]);

  useEffect(() => {
    setPendingFileRemovals((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const existing = new Set(
        files.map((file) => normalizeRelativePath(file.relative_path)),
      );
      const next = prev.filter((path) => existing.has(normalizeRelativePath(path)));
      return next.length === prev.length ? prev : next;
    });
  }, [files]);

  useEffect(() => {
    setPendingDirRemovals((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const existing = new Set(folders.map((path) => normalizeFolderPath(path)));
      const next = prev.filter((path) => existing.has(normalizeFolderPath(path)));
      return next.length === prev.length ? prev : next;
    });
  }, [folders]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    return registerCloseLayer({
      id: "vault-context-menu",
      priority: 200,
      isActive: () => true,
      onClose: closeContextMenu,
    });
  }, [closeContextMenu, contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) {
      return;
    }
    const padding = 8;
    const rect = menuRef.current.getBoundingClientRect();
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding;
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = window.innerHeight - rect.height - padding;
    }
    setMenuStyle({
      left: Math.max(padding, left),
      top: Math.max(padding, top),
    });
  }, [contextMenu]);

  const openContextMenu = useCallback(
    (event: MouseEvent, target: ContextMenuTarget) => {
      event.preventDefault();
      event.stopPropagation();
      if (target.kind === "file") {
        setSelectedNode({ kind: "file", file: target.file });
      } else if (target.kind === "dir") {
        setSelectedNode({ kind: "dir", path: target.path });
      } else {
        setSelectedNode(null);
      }
      setContextMenu({ target, x: event.clientX, y: event.clientY });
      setMenuStyle({ left: event.clientX, top: event.clientY });
    },
    [],
  );

  const reportOpenError = useCallback((message: string, details: Record<string, unknown>) => {
    const errorText =
      "error" in details ? asErrorMessage(details.error, "").trim() : "";
    const fullMessage = errorText ? `${message} ${errorText}` : message;
    setOpenError(fullMessage);
    console.error(message, details);
  }, []);

  const openCreateModal = useCallback(
    (kind: "file" | "folder", dirPath: string) => {
      setCreateKind(kind);
      setCreateDirPath(dirPath);
      setCreateName(kind === "file" ? DEFAULT_FILE_NAME : DEFAULT_FOLDER_NAME);
      setCreateError("");
      setContextMenu(null);
    },
    [],
  );

  const closeDeleteModal = useCallback(() => {
    if (isDeleting) {
      return;
    }
    setDeleteTarget(null);
    setDeleteError("");
  }, [isDeleting]);

  const requestDelete = useCallback((file: VaultFile) => {
    setDeleteTarget(file);
    setDeleteError("");
    setContextMenu(null);
  }, []);

  const handleOpenDataFolder = useCallback(
    async (target: ContextMenuTarget | null) => {
      closeContextMenu();
      if (!vaultPath || !target) {
        if (!vaultPath) {
          setOpenError("Select a vault to open folders.");
        }
        return;
      }
      const resolved = resolveNodePaths(target, vaultPath);
      const { folderAbsPath, relativePath } = resolved;
      setOpenError("");
      try {
        const info = await invoke<PathInfo>("get_path_info", {
          path: folderAbsPath,
        });
        if (!info.exists || !info.isDir) {
          reportOpenError("Folder not found on disk.", {
            nodeKind: resolved.kind,
            relativePath,
            folderAbsPath,
            fileAbsPath: resolved.fileAbsPath,
            info,
          });
          return;
        }
        if (resolved.kind === "file" && resolved.fileAbsPath) {
          try {
            await revealItemInDir(resolved.fileAbsPath);
            return;
          } catch (revealError) {
            console.warn("Could not reveal item in system explorer. Falling back to folder open.", {
              relativePath,
              folderAbsPath,
              fileAbsPath: resolved.fileAbsPath,
              revealError,
            });
          }
        }
        await openPath(folderAbsPath);
      } catch (error) {
        reportOpenError("Could not open in system explorer.", {
          nodeKind: resolved.kind,
          relativePath,
          folderAbsPath,
          fileAbsPath: resolved.fileAbsPath,
          error,
        });
      }
    },
    [closeContextMenu, reportOpenError, vaultPath],
  );

  const handleOpenWithDefault = useCallback(
    async (file: VaultFile | null) => {
      closeContextMenu();
      if (!vaultPath || !file) {
        if (!vaultPath) {
          setOpenError("Select a vault to open files.");
        }
        return;
      }
      const resolved = resolveNodePaths(
        {
          kind: "file",
          file,
          dirPath: getParentRelativePath(file.relative_path),
        },
        vaultPath,
      );
      const fileAbsPath = resolved.fileAbsPath ?? file.path;
      setOpenError("");
      try {
        const info = await invoke<PathInfo>("get_path_info", {
          path: fileAbsPath,
        });
        if (!info.exists || info.isDir) {
          reportOpenError("File not found on disk.", {
            nodeKind: "file",
            relativePath: resolved.relativePath,
            fileAbsPath,
            folderAbsPath: resolved.folderAbsPath,
            info,
          });
          return;
        }
        await openPath(fileAbsPath);
      } catch (error) {
        reportOpenError("Could not open with the default app.", {
          nodeKind: "file",
          relativePath: resolved.relativePath,
          fileAbsPath,
          folderAbsPath: resolved.folderAbsPath,
          error,
        });
      }
    },
    [closeContextMenu, reportOpenError, vaultPath],
  );

  const invokeDelete = useCallback(
    (vaultRoot: string, relativePath: string) =>
      invoke<void>("delete_markdown_file", { vaultPath: vaultRoot, relativePath }),
    [],
  );

  const invokeMove = useCallback(
    (vaultRoot: string, fromRelativePath: string, toRelativePath: string) =>
      invoke<VaultFile>("move_markdown_file", {
        vaultPath: vaultRoot,
        fromRelativePath,
        toRelativePath,
      }),
    [],
  );

  const invokeMoveDirectory = useCallback(
    (vaultRoot: string, fromRelativePath: string, toRelativePath: string) =>
      invoke<void>("move_directory", {
        vaultPath: vaultRoot,
        fromRelativePath,
        toRelativePath,
      }),
    [],
  );

  const invokeDeleteFolder = useCallback(
    (vaultRoot: string, relativePath: string) =>
      invoke<void>("delete_directory", { vaultPath: vaultRoot, relativePath }),
    [],
  );

  const { handleCancel: handleDeleteCancel, handleConfirm: handleDeleteConfirm } = useMemo(
    () =>
      buildVaultDeleteHandlers({
        vaultPath,
        deleteTarget,
        selectedFile,
        isDeleting,
        invokeDelete,
        onRescanVault,
        onClose: closeDeleteModal,
        onClearSelection,
        setError: setDeleteError,
        setIsDeleting,
      }),
    [
      closeDeleteModal,
      deleteTarget,
      invokeDelete,
      isDeleting,
      onClearSelection,
      onRescanVault,
      selectedFile,
      vaultPath,
    ],
  );

  const closeFolderDeleteModal = useCallback(() => {
    if (isDeletingFolder) {
      return;
    }
    setDeleteFolderTarget(null);
    setDeleteFolderError("");
  }, [isDeletingFolder]);

  const requestFolderDelete = useCallback((path: string) => {
    const normalized = normalizeFolderPath(path);
    if (!normalized) {
      return;
    }
    const name = normalized.split("/").pop() ?? normalized;
    setDeleteFolderTarget({ path: normalized, name });
    setDeleteFolderError("");
    setContextMenu(null);
  }, []);

  const handleFolderDeleteConfirm = useCallback(async () => {
    if (!vaultPath || !deleteFolderTarget || isDeletingFolder) {
      return;
    }
    const normalized = normalizeFolderPath(deleteFolderTarget.path);
    if (!normalized) {
      setDeleteFolderError("Cannot delete the vault root.");
      return;
    }
    setIsDeletingFolder(true);
    setDeleteFolderError("");
    try {
      await invokeDeleteFolder(vaultPath, normalized);
      setPendingDirRemovals((prev) =>
        prev.includes(normalized) ? prev : [...prev, normalized],
      );
      if (
        selectedFile &&
        isPathWithin(normalizeRelativePath(selectedFile.relative_path), normalized)
      ) {
        onClearSelection?.();
        setStatusMessage("Open file was deleted.");
      }
      setSelectedNode(null);
      onRescanVault();
      closeFolderDeleteModal();
    } catch (error) {
      setDeleteFolderError(asErrorMessage(error, "Failed to delete folder."));
    } finally {
      setIsDeletingFolder(false);
    }
  }, [
    closeFolderDeleteModal,
    deleteFolderTarget,
    invokeDeleteFolder,
    isDeletingFolder,
    onClearSelection,
    onRescanVault,
    selectedFile,
    vaultPath,
  ]);

  const startRenameFile = useCallback((file: VaultFile) => {
    const relativePath = normalizeRelativePath(file.relative_path);
    const name = getFileName(relativePath);
    const parentPath = normalizeFolderPath(getParentRelativePath(relativePath));
    const extensionMatch = name.match(/\.md$/i);
    setRenameTarget({ kind: "file", path: relativePath, parentPath, name });
    setRenameDraft(name);
    setRenameError("");
    setRenameRange(
      extensionMatch
        ? { start: 0, end: Math.max(0, name.length - extensionMatch[0].length) }
        : null,
    );
    setIsRenaming(false);
    setContextMenu(null);
  }, []);

  const startRenameDir = useCallback((path: string) => {
    const normalized = normalizeFolderPath(path);
    if (!normalized) {
      return;
    }
    const name = getFileName(normalized);
    const parentPath = normalizeFolderPath(getParentRelativePath(normalized));
    setRenameTarget({ kind: "dir", path: normalized, parentPath, name });
    setRenameDraft(name);
    setRenameError("");
    setRenameRange(null);
    setIsRenaming(false);
    setContextMenu(null);
  }, []);

  const handleRenameCancel = useCallback(() => {
    if (isRenaming) {
      return;
    }
    setRenameTarget(null);
    setRenameDraft("");
    setRenameError("");
    setRenameRange(null);
  }, [isRenaming]);

  const handleRenameCommit = useCallback(async () => {
    if (!renameTarget || !vaultPath || isRenaming) {
      return;
    }
    const trimmed = normalizeNewName(renameDraft);
    if (!trimmed) {
      setRenameError("Name is required.");
      return;
    }
    if (NAME_FORBIDDEN_PATTERN.test(trimmed) || trimmed === "." || trimmed === "..") {
      setRenameError("Name cannot include / or \\ characters.");
      return;
    }
    let nextName = trimmed;
    if (renameTarget.kind === "file") {
      if (/\.[^./\\]+$/.test(trimmed) && !/\.md$/i.test(trimmed)) {
        setRenameError("Only .md files are supported.");
        return;
      }
      nextName = ensureMarkdownExtension(trimmed);
      const baseName = nextName.replace(/\.md$/i, "").trim();
      if (!baseName) {
        setRenameError("Name is required.");
        return;
      }
    }
    const existingNames = getChildNameSet(treeNodes, renameTarget.parentPath);
    existingNames.delete(renameTarget.name.trim().toLowerCase());
    if (existingNames.has(nextName.toLowerCase())) {
      setRenameError("Name already exists in this folder.");
      return;
    }
    const targetRelative = renameTarget.parentPath
      ? `${renameTarget.parentPath}/${nextName}`
      : nextName;
    const normalizedTarget = normalizeRelativePath(targetRelative);
    const normalizedSource = normalizeRelativePath(renameTarget.path);
    if (normalizedSource === normalizedTarget) {
      handleRenameCancel();
      return;
    }
    setIsRenaming(true);
    setRenameError("");
    try {
      if (renameTarget.kind === "file") {
        const moved = await invokeMove(vaultPath, normalizedSource, normalizedTarget);
        setPendingFileRemovals((prev) =>
          prev.includes(normalizedSource) ? prev : [...prev, normalizedSource],
        );
        setPendingFiles((prev) =>
          prev.some((entry) => entry.path === moved.path) ? prev : [...prev, moved],
        );
        if (
          selectedFile &&
          normalizeRelativePath(selectedFile.relative_path) === normalizedSource
        ) {
          onSelectFile(moved);
        }
        setSelectedNode({ kind: "file", file: moved });
      } else {
        await invokeMoveDirectory(vaultPath, normalizedSource, normalizedTarget);
        setPendingDirRemovals((prev) =>
          prev.includes(normalizedSource) ? prev : [...prev, normalizedSource],
        );
        setExtraDirs((prev) =>
          prev.includes(normalizedTarget) ? prev : [...prev, normalizedTarget],
        );
        if (
          selectedFile &&
          isPathWithin(
            normalizeRelativePath(selectedFile.relative_path),
            normalizedSource,
          )
        ) {
          const suffix = normalizeRelativePath(selectedFile.relative_path).slice(
            normalizedSource.length,
          );
          const nextRelative = normalizeRelativePath(`${normalizedTarget}${suffix}`);
          onSelectFile({
            path: joinVaultPath(vaultPath, nextRelative),
            relative_path: nextRelative,
          });
        }
        if (
          normalizedActiveFolderPath &&
          isPathWithin(normalizedActiveFolderPath, normalizedSource)
        ) {
          const suffix = normalizedActiveFolderPath.slice(normalizedSource.length);
          const nextActive = normalizeFolderPath(`${normalizedTarget}${suffix}`);
          onActiveFolderChange(nextActive);
        }
        setSelectedNode({ kind: "dir", path: normalizedTarget });
      }
      onRescanVault();
      setRenameTarget(null);
      setRenameDraft("");
      setRenameRange(null);
    } catch (error) {
      setRenameError(asErrorMessage(error, "Failed to rename."));
    } finally {
      setIsRenaming(false);
    }
  }, [
    handleRenameCancel,
    invokeMove,
    invokeMoveDirectory,
    isRenaming,
    normalizedActiveFolderPath,
    onActiveFolderChange,
    onRescanVault,
    onSelectFile,
    renameDraft,
    renameTarget,
    selectedFile,
    treeNodes,
    vaultPath,
  ]);

  const getFileMoveInfo = useCallback(
    (file: VaultFile, targetDirPath: string) => {
      const sourceRelative = normalizeRelativePath(file.relative_path);
      const sourceDir = normalizeFolderPath(getParentRelativePath(sourceRelative));
      const fileName = getFileName(sourceRelative);
      const targetDir = normalizeFolderPath(targetDirPath);
      const targetRelative = targetDir ? `${targetDir}/${fileName}` : fileName;
      if (sourceDir === targetDir) {
        return { allowed: false, reason: "same-folder", targetDir, targetRelative };
      }
      const existingNames = getChildNameSet(treeNodes, targetDir);
      if (existingNames.has(fileName.trim().toLowerCase())) {
        return { allowed: false, reason: "exists", targetDir, targetRelative };
      }
      return { allowed: true, reason: null, targetDir, targetRelative };
    },
    [treeNodes],
  );

  const getDirMoveInfo = useCallback(
    (sourceDirPath: string, targetDirPath: string) => {
      const sourceDir = normalizeFolderPath(sourceDirPath);
      const targetDir = normalizeFolderPath(targetDirPath);
      if (!sourceDir) {
        return { allowed: false, reason: "root", targetDir, targetRelative: "" };
      }
      if (sourceDir === targetDir) {
        return { allowed: false, reason: "same-folder", targetDir, targetRelative: "" };
      }
      if (isPathWithin(targetDir, sourceDir)) {
        return { allowed: false, reason: "descendant", targetDir, targetRelative: "" };
      }
      const sourceParent = normalizeFolderPath(getParentRelativePath(sourceDir));
      const folderName = getFileName(sourceDir);
      const targetRelative = targetDir ? `${targetDir}/${folderName}` : folderName;
      if (sourceParent === targetDir) {
        return { allowed: false, reason: "same-folder", targetDir, targetRelative };
      }
      const existingNames = getChildNameSet(treeNodes, targetDir);
      if (existingNames.has(folderName.trim().toLowerCase())) {
        return { allowed: false, reason: "exists", targetDir, targetRelative };
      }
      return { allowed: true, reason: null, targetDir, targetRelative };
    },
    [treeNodes],
  );

  const handleMoveFile = useCallback(
    async (file: VaultFile, targetDirPath: string) => {
      if (!vaultPath) {
        setMoveError("Select a vault to move files.");
        return;
      }
      const moveInfo = getFileMoveInfo(file, targetDirPath);
      if (!moveInfo.allowed) {
        setMoveError(
          moveInfo.reason === "exists"
            ? "A file with the same name already exists in that folder."
            : "File is already in that folder.",
        );
        return;
      }
      setMoveError("");
      setStatusMessage("");
      try {
        const moved = await invokeMove(
          vaultPath,
          normalizeRelativePath(file.relative_path),
          moveInfo.targetRelative,
        );
        const normalizedSource = normalizeRelativePath(file.relative_path);
        setPendingFileRemovals((prev) =>
          prev.includes(normalizedSource) ? prev : [...prev, normalizedSource],
        );
        setPendingFiles((prev) =>
          prev.some((entry) => entry.path === moved.path) ? prev : [...prev, moved],
        );
        if (selectedFile?.path === file.path) {
          onSelectFile(moved);
        }
        setSelectedNode({ kind: "file", file: moved });
        onRescanVault();
      } catch (error) {
        setMoveError(asErrorMessage(error, "Failed to move file."));
      }
    },
    [
      getFileMoveInfo,
      invokeMove,
      onRescanVault,
      onSelectFile,
      selectedFile,
      vaultPath,
    ],
  );

  const handleMoveDirectory = useCallback(
    async (sourceDirPath: string, targetDirPath: string) => {
      if (!vaultPath) {
        setMoveError("Select a vault to move folders.");
        return;
      }
      const moveInfo = getDirMoveInfo(sourceDirPath, targetDirPath);
      if (!moveInfo.allowed) {
        const reason =
          moveInfo.reason === "exists"
            ? "A folder with the same name already exists in that folder."
            : moveInfo.reason === "descendant"
              ? "Cannot move a folder into itself."
              : moveInfo.reason === "root"
                ? "Cannot move the vault root folder."
                : "Folder is already in that location.";
        setMoveError(reason);
        return;
      }
      setMoveError("");
      setStatusMessage("");
      const normalizedSource = normalizeFolderPath(sourceDirPath);
      try {
        await invokeMoveDirectory(vaultPath, normalizedSource, moveInfo.targetRelative);
        setPendingDirRemovals((prev) =>
          prev.includes(normalizedSource) ? prev : [...prev, normalizedSource],
        );
        setExtraDirs((prev) =>
          prev.includes(moveInfo.targetRelative)
            ? prev
            : [...prev, moveInfo.targetRelative],
        );
        if (
          selectedFile &&
          isPathWithin(
            normalizeRelativePath(selectedFile.relative_path),
            normalizedSource,
          )
        ) {
          const suffix = normalizeRelativePath(selectedFile.relative_path).slice(
            normalizedSource.length,
          );
          const nextRelative = normalizeRelativePath(
            `${moveInfo.targetRelative}${suffix}`,
          );
          onSelectFile({
            path: joinVaultPath(vaultPath, nextRelative),
            relative_path: nextRelative,
          });
        }
        if (
          normalizedActiveFolderPath &&
          isPathWithin(normalizedActiveFolderPath, normalizedSource)
        ) {
          const suffix = normalizedActiveFolderPath.slice(normalizedSource.length);
          const nextActive = normalizeFolderPath(
            `${moveInfo.targetRelative}${suffix}`,
          );
          onActiveFolderChange(nextActive);
        }
        setSelectedNode({ kind: "dir", path: moveInfo.targetRelative });
        onRescanVault();
      } catch (error) {
        setMoveError(asErrorMessage(error, "Failed to move folder."));
      }
    },
    [
      getDirMoveInfo,
      normalizedActiveFolderPath,
      onActiveFolderChange,
      onRescanVault,
      onSelectFile,
      selectedFile,
      vaultPath,
      invokeMoveDirectory,
    ],
  );

  const handleFileDragStart = useCallback(
    (event: DragEvent<HTMLElement>, file: VaultFile) => {
      if (!vaultPath) {
        return;
      }
      setDraggedNode({ kind: "file", file });
      setSelectedNode({ kind: "file", file });
      setMoveError("");
      setStatusMessage("");
      startInternalDrag(event, {
        channel: DRAG_CHANNELS.VAULT_TREE,
        payload: { kind: "file", file } satisfies VaultTreeDragPayload,
        plainTextFallback: file.relative_path,
        effectAllowed: "move",
      });
    },
    [vaultPath],
  );

  const handleDirDragStart = useCallback(
    (event: DragEvent<HTMLElement>, path: string) => {
      if (!vaultPath) {
        return;
      }
      const normalized = normalizeFolderPath(path);
      if (!normalized) {
        return;
      }
      setDraggedNode({ kind: "dir", path: normalized, name: getFileName(normalized) });
      setSelectedNode({ kind: "dir", path: normalized });
      setMoveError("");
      setStatusMessage("");
      startInternalDrag(event, {
        channel: DRAG_CHANNELS.VAULT_TREE,
        payload: {
          kind: "dir",
          path: normalized,
          name: getFileName(normalized),
        } satisfies VaultTreeDragPayload,
        plainTextFallback: normalized,
        effectAllowed: "move",
      });
    },
    [vaultPath],
  );

  const clearDragState = useCallback(() => {
    setDraggedNode(null);
    setDragOverPath(null);
    setDragOverState(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    clearDragState();
    endInternalDrag(DRAG_CHANNELS.VAULT_TREE);
  }, [clearDragState]);

  const handleFolderDragOver = useCallback(
    (event: DragEvent<HTMLElement>, path: string) => {
      const fallbackPayload = !draggedNode
        ? asVaultTreeDragPayload(readInternalDrag<unknown>(event, {
          channel: DRAG_CHANNELS.VAULT_TREE,
        }))
        : null;
      const activeDraggedNode = draggedNode ?? fallbackPayload;
      if (!activeDraggedNode) {
        return;
      }
      const moveInfo =
        activeDraggedNode.kind === "file"
          ? getFileMoveInfo(activeDraggedNode.file, path)
          : getDirMoveInfo(activeDraggedNode.path, path);
      if (!moveInfo.allowed) {
        setDragOverPath(path);
        setDragOverState("invalid");
        setDropEffectSafe(event, "none");
        return;
      }
      event.preventDefault();
      setDropEffectSafe(event, "move");
      setDragOverPath(path);
      setDragOverState("valid");
    },
    [draggedNode, getDirMoveInfo, getFileMoveInfo],
  );

  const handleFolderDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    setDragOverPath(null);
    setDragOverState(null);
  }, []);

  const handleFolderDrop = useCallback(
    async (event: DragEvent<HTMLElement>, path: string) => {
      event.preventDefault();
      const activeNode = draggedNode ?? asVaultTreeDragPayload(readInternalDrag<unknown>(event, {
        channel: DRAG_CHANNELS.VAULT_TREE,
      }));
      if (!activeNode) {
        endInternalDrag(DRAG_CHANNELS.VAULT_TREE);
        return;
      }
      const moveInfo =
        activeNode.kind === "file"
          ? getFileMoveInfo(activeNode.file, path)
          : getDirMoveInfo(activeNode.path, path);
      clearDragState();
      if (!moveInfo.allowed) {
        const defaultMessage =
          activeNode.kind === "file"
            ? "File is already in that folder."
            : "Folder is already in that location.";
        const reasonMessage =
          moveInfo.reason === "exists"
            ? activeNode.kind === "file"
              ? "A file with the same name already exists in that folder."
              : "A folder with the same name already exists in that folder."
            : activeNode.kind === "dir" && moveInfo.reason === "descendant"
              ? "Cannot move a folder into itself."
              : activeNode.kind === "dir" && moveInfo.reason === "root"
                ? "Cannot move the vault root folder."
                : defaultMessage;
        setMoveError(reasonMessage);
        endInternalDrag(DRAG_CHANNELS.VAULT_TREE);
        return;
      }
      if (activeNode.kind === "file") {
        await handleMoveFile(activeNode.file, path);
      } else {
        await handleMoveDirectory(activeNode.path, path);
      }
      endInternalDrag(DRAG_CHANNELS.VAULT_TREE);
    },
    [clearDragState, draggedNode, getDirMoveInfo, getFileMoveInfo, handleMoveDirectory, handleMoveFile],
  );

  const handleVaultKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (shouldHandleVaultRenameShortcut(event)) {
        const selectedDir =
          selectedNode && selectedNode.kind === "dir" ? selectedNode.path : null;
        if (selectedDir !== null) {
          if (!normalizeFolderPath(selectedDir)) {
            return;
          }
          event.preventDefault();
          startRenameDir(selectedDir);
          return;
        }
        const fileTarget =
          selectedNode && selectedNode.kind === "file"
            ? selectedNode.file
            : selectedFile;
        if (!fileTarget) {
          return;
        }
        if (!isMarkdownFilePath(fileTarget.relative_path)) {
          return;
        }
        event.preventDefault();
        startRenameFile(fileTarget);
        return;
      }
      if (!shouldHandleVaultDeleteShortcut(event)) {
        return;
      }
      const selectedDir =
        selectedNode && selectedNode.kind === "dir" ? selectedNode.path : null;
      if (selectedDir !== null) {
        if (!normalizeFolderPath(selectedDir)) {
          return;
        }
        event.preventDefault();
        requestFolderDelete(selectedDir);
        return;
      }
      const fileTarget =
        selectedNode && selectedNode.kind === "file"
          ? selectedNode.file
          : selectedFile;
      if (!fileTarget) {
        return;
      }
      if (!isMarkdownFilePath(fileTarget.relative_path)) {
        setDeleteError("Only markdown files can be deleted.");
        return;
      }
      event.preventDefault();
      requestDelete(fileTarget);
    },
    [
      requestDelete,
      requestFolderDelete,
      selectedFile,
      selectedNode,
      startRenameDir,
      startRenameFile,
    ],
  );

  const handleCreateConfirm = useCallback(async () => {
    if (!createKind || !vaultPath) {
      return;
    }
    const trimmed = normalizeNewName(createName);
    if (!trimmed) {
      setCreateError("Name is required.");
      return;
    }
    if (NAME_FORBIDDEN_PATTERN.test(trimmed) || trimmed === "." || trimmed === "..") {
      setCreateError("Name cannot include / or \\ characters.");
      return;
    }
    const existingNames = getChildNameSet(treeNodes, createDirPath);
    const preparedName =
      createKind === "file" ? ensureMarkdownExtension(trimmed) : trimmed;
    const baseName = preparedName.replace(/\.md$/i, "").trim();
    if (createKind === "file" && !baseName) {
      setCreateError("Name is required.");
      return;
    }
    const uniqueName = ensureUniqueName(preparedName, existingNames, createKind);
    const relativePath = createDirPath
      ? `${createDirPath}/${uniqueName}`
      : uniqueName;
    setIsCreating(true);
    setCreateError("");
    try {
      if (createKind === "file") {
        const created = await invoke<VaultFile>("create_markdown_file", {
          vaultPath,
          relativePath,
        });
        setPendingFiles((prev) =>
          prev.some((file) => file.path === created.path)
            ? prev
            : [...prev, created],
        );
        if (createDirPath && !expandedPaths.has(createDirPath)) {
          onTogglePath(createDirPath, true);
        }
        onSelectFile(created);
      } else {
        await invoke("create_directory", {
          vaultPath,
          relativePath,
        });
        setExtraDirs((prev) =>
          prev.includes(relativePath) ? prev : [...prev, relativePath],
        );
        if (createDirPath && !expandedPaths.has(createDirPath)) {
          onTogglePath(createDirPath, true);
        }
        if (relativePath && !expandedPaths.has(relativePath)) {
          onTogglePath(relativePath, true);
        }
        onActiveFolderChange(relativePath);
      }
      onRescanVault();
      setCreateKind(null);
      setCreateName("");
    } catch (error) {
      setCreateError(asErrorMessage(error, "Failed to create entry."));
    } finally {
      setIsCreating(false);
    }
  }, [
    createDirPath,
    createKind,
    createName,
    expandedPaths,
    onRescanVault,
    onSelectFile,
    onTogglePath,
    onActiveFolderChange,
    treeNodes,
    vaultPath,
  ]);

  const handleCreateCancel = useCallback(() => {
    if (isCreating) {
      return;
    }
    setCreateKind(null);
    setCreateName("");
    setCreateError("");
  }, [isCreating]);

  const handleEmptyContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!vaultPath) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest(".tree-item")) {
        return;
      }
      const dirPath = activeFolderPath ?? "";
      openContextMenu(event, { kind: "empty", path: dirPath });
    },
    [activeFolderPath, openContextMenu, vaultPath],
  );
  const menuTarget = contextMenu?.target ?? null;
  const fileTarget = menuTarget && menuTarget.kind === "file" ? menuTarget : null;
  const dirTarget = menuTarget && menuTarget.kind === "dir" ? menuTarget : null;
  const menuDirPath =
    menuTarget?.kind === "file" ? menuTarget.dirPath : menuTarget?.path ?? "";
  const canDeleteFile = fileTarget
    ? isMarkdownFilePath(fileTarget.file.relative_path)
    : false;
  const canRenameFile = canDeleteFile;
  const canDeleteDir = dirTarget ? normalizeFolderPath(dirTarget.path) !== "" : false;
  const canRenameDir = canDeleteDir;
  const deleteFileName = deleteTarget
    ? deleteTarget.relative_path.split("/").pop() ?? deleteTarget.relative_path
    : "";
  const deleteFolderName = deleteFolderTarget?.name ?? "";
  const rootFolderState = getFolderState("");
  const rootDropState = dragOverPath === "" ? dragOverState : null;
  const rootDropClass =
    rootDropState === "valid"
      ? " drop-target"
      : rootDropState === "invalid"
        ? " drop-target-invalid"
        : "";
  const contextMenuLayer = contextMenu ? (
    <div
      className="context-menu-backdrop"
      role="presentation"
      onMouseDown={closeContextMenu}
    >
      <div
        ref={menuRef}
        className="context-menu"
        style={menuStyle ?? { left: contextMenu.x, top: contextMenu.y }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="context-menu-item"
          onClick={() => {
            closeContextMenu();
            void onRescanVault("vault-tree:context-menu");
          }}
          disabled={!vaultPath || listState === "loading"}
        >
          Refresh Active Vault
        </button>
        {fileTarget ? (
          <>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                void handleOpenDataFolder(menuTarget);
              }}
            >
              View Folder
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                void handleOpenWithDefault(fileTarget.file);
              }}
            >
              View Files
            </button>
            {canRenameFile ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                  startRenameFile(fileTarget.file);
                }}
              >
                Rename
              </button>
            ) : null}
            {canDeleteFile ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                  requestDelete(fileTarget.file);
                }}
              >
                Delete
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => openCreateModal("file", menuDirPath)}
            >
              New File
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => openCreateModal("folder", menuDirPath)}
            >
              New Folder
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                void handleOpenDataFolder(menuTarget);
              }}
            >
              View Folder
            </button>
            {dirTarget && canRenameDir ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={() => startRenameDir(dirTarget.path)}
              >
                Rename
              </button>
            ) : null}
            {dirTarget && canDeleteDir ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={() => requestFolderDelete(dirTarget.path)}
              >
                Delete
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  ) : null;

  const renderTreeNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const indentStyle = getIndentVars(depth);
      const hiddenClass = isHiddenPath(node.path) ? " is-hidden" : "";
      if (node.type === "dir") {
        const isOpen = expandedPaths.has(node.path);
        const { isActiveFolder, isBreadcrumb } = getFolderState(node.path);
        const isRenamingDir =
          renameTarget?.kind === "dir" && renameTarget.path === node.path;
        const isDraggingDir =
          draggedNode?.kind === "dir" && draggedNode.path === node.path;
        const dropState = dragOverPath === node.path ? dragOverState : null;
        const dropClass =
          dropState === "valid"
            ? " drop-target"
            : dropState === "invalid"
              ? " drop-target-invalid"
              : "";
        return (
          <details
            className="tree-dir"
            key={node.path}
            open={isOpen}
            onToggle={(event) => {
              onTogglePath(node.path, event.currentTarget.open);
            }}
          >
            <summary
              className={`tree-item${isActiveFolder ? " active-folder" : ""}${
                isBreadcrumb ? " breadcrumb" : ""
              }${hiddenClass}${dropClass}${isDraggingDir ? " is-dragging" : ""}`}
              title={node.path}
              style={indentStyle}
              draggable={node.path !== "" && !isRenamingDir}
              onClick={() => {
                onActiveFolderChange(node.path);
                setSelectedNode({ kind: "dir", path: node.path });
              }}
              onContextMenu={(event) => {
                onActiveFolderChange(node.path);
                openContextMenu(event, { kind: "dir", path: node.path });
              }}
              onDragStart={(event) => handleDirDragStart(event, node.path)}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => handleFolderDragOver(event, node.path)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(event) => void handleFolderDrop(event, node.path)}
            >
              <span className="tree-icon">
                <FolderIcon />
              </span>
              <InlineRenameLabel
                value={node.name}
                isEditing={isRenamingDir}
                draft={isRenamingDir ? renameDraft : node.name}
                error={isRenamingDir ? renameError : undefined}
                className="inline-rename"
                displayClassName="tree-name"
                inputClassName="inline-rename-input"
                selectRange={isRenamingDir ? renameRange : null}
                onDraftChange={(value) => {
                  setRenameDraft(value);
                  if (renameError) {
                    setRenameError("");
                  }
                }}
                onCommit={handleRenameCommit}
                onCancel={handleRenameCancel}
              />
            </summary>
            <div className="tree-children" style={indentStyle}>
              {renderTreeNodes(node.children ?? [], depth + 1)}
            </div>
          </details>
        );
      }

      const fileRef =
        node.file ??
        (node.fullPath ? { path: node.fullPath, relative_path: node.path } : null);
      const isActive = !!fileRef && selectedFile?.path === fileRef.path;
      const isRenamingFile =
        !!fileRef &&
        renameTarget?.kind === "file" &&
        renameTarget.path === normalizeRelativePath(fileRef.relative_path);
      const isDragging =
        !!fileRef &&
        draggedNode?.kind === "file" &&
        draggedNode.file.path === fileRef.path;

      if (isRenamingFile) {
        return (
          <div
            key={node.path}
            className={`tree-item tree-file ${isActive ? "active" : ""}${
              hiddenClass
            }`}
            style={indentStyle}
          >
            <span className="tree-icon">
              <FileIcon />
            </span>
            <InlineRenameLabel
              value={node.name}
              isEditing={isRenamingFile}
              draft={renameDraft}
              error={renameError}
              className="inline-rename"
              displayClassName="tree-name"
              inputClassName="inline-rename-input"
              selectRange={renameRange}
              onDraftChange={(value) => {
                setRenameDraft(value);
                if (renameError) {
                  setRenameError("");
                }
              }}
              onCommit={handleRenameCommit}
              onCancel={handleRenameCancel}
            />
          </div>
        );
      }

      return (
        <button
          type="button"
          key={node.path}
          className={`tree-item tree-file ${isActive ? "active" : ""}${
            isDragging ? " is-dragging" : ""
          }${hiddenClass}`}
          onClick={(event) => {
            if (!fileRef) {
              return;
            }
            setSelectedNode({ kind: "file", file: fileRef });
            onSelectFile(fileRef, {
              openInNewTab: event.ctrlKey || event.metaKey,
            });
          }}
          title={node.path}
          disabled={!fileRef}
          style={indentStyle}
          onContextMenu={(event) => {
            if (!fileRef) {
              return;
            }
            const dirPath = getParentRelativePath(fileRef.relative_path);
            openContextMenu(event, { kind: "file", file: fileRef, dirPath });
          }}
          draggable={Boolean(fileRef) && !isRenamingFile}
          onDragStart={(event) => {
            if (!fileRef) {
              return;
            }
            handleFileDragStart(event, fileRef);
          }}
          onDragEnd={handleDragEnd}
        >
          <span className="tree-icon">
            <FileIcon />
          </span>
          <span className="tree-name">{node.name}</span>
        </button>
      );
    });

  return (
    <div className="vault-details">
      <div className="vault-details-header">
        <div className="vault-details-row vault-details-row--actions">
          <span className="vault-details-title">Vault Directory</span>
          <button
            type="button"
            className="vault-directory-action"
            onClick={() => void onRescanVault("vault-tree:header-refresh")}
            title={refreshTitle}
            aria-label={refreshTitle}
            disabled={!vaultPath || isRescanningVault}
          >
            <span
              className={`vault-directory-action-icon${
                isRescanningVault ? " is-spinning" : ""
              }`}
            >
              <RefreshIcon />
            </span>
          </button>
        </div>
        <div className="vault-details-row">
          <span className="vault-summary">{fileCountLabel}</span>
        </div>
      </div>
      <div className="vault-body">
        <div
          className={`vault-tree-scroll${hasDeepIndent ? " vault-tree-scroll-wide" : ""}`}
          onContextMenu={handleEmptyContextMenu}
          onKeyDown={handleVaultKeyDown}
          tabIndex={0}
        >
          {!vaultPath ? (
            <div className="empty-state">
              Select a vault to view the directory.
            </div>
          ) : null}
          {listState === "loading" ? <span className="chip">Scanne...</span> : null}
          {listError ? <div className="error">{listError}</div> : null}
          {openError ? <div className="error">{openError}</div> : null}
          {moveError ? <div className="error">{moveError}</div> : null}
          {deleteError ? <div className="error">{deleteError}</div> : null}
          {statusMessage ? <div className="muted">{statusMessage}</div> : null}
          {vaultPath && listState === "idle" && treeNodes.length === 0 ? (
            <div className="empty-state">Keine Markdown-Dateien in diesem Vault.</div>
          ) : null}
          {vaultPath && listState === "idle" && treeNodes.length > 0 ? (
            <div className="vault-tree">
              <details className="tree-dir" open>
                <summary
                  className={`tree-item${
                    rootFolderState.isActiveFolder ? " active-folder" : ""
                  }${rootFolderState.isBreadcrumb ? " breadcrumb" : ""}${
                    rootDropClass
                  }`}
                  style={getIndentVars(0)}
                  onClick={() => {
                    onActiveFolderChange("");
                    setSelectedNode({ kind: "dir", path: "" });
                  }}
                  onContextMenu={(event) => {
                    onActiveFolderChange("");
                    openContextMenu(event, { kind: "dir", path: "" });
                  }}
                  onDragOver={(event) => handleFolderDragOver(event, "")}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(event) => void handleFolderDrop(event, "")}
                >
                  <span className="tree-icon">
                    <FolderIcon />
                  </span>
                  <span className="tree-name">{vaultRootName}</span>
                </summary>
                <div className="tree-children" style={getIndentVars(0)}>
                  {renderTreeNodes(treeNodes, 1)}
                </div>
              </details>
            </div>
          ) : null}
        </div>
      </div>
      {contextMenuLayer
        ? portalTarget
          ? createPortal(contextMenuLayer, portalTarget)
          : contextMenuLayer
        : null}
      <VaultDeleteModal
        isOpen={Boolean(deleteTarget)}
        fileName={deleteFileName}
        error={deleteError}
        isPending={isDeleting}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
      <VaultDeleteModal
        isOpen={Boolean(deleteFolderTarget)}
        fileName={deleteFolderName}
        error={deleteFolderError}
        isPending={isDeletingFolder}
        kind="folder"
        onCancel={closeFolderDeleteModal}
        onConfirm={handleFolderDeleteConfirm}
      />
      <VaultCreateModal
        isOpen={createKind !== null}
        kind={createKind ?? "file"}
        name={createName}
        error={createError}
        isPending={isCreating}
        onNameChange={(value) => {
          setCreateName(value);
          if (createError) {
            setCreateError("");
          }
        }}
        onCancel={handleCreateCancel}
        onConfirm={handleCreateConfirm}
      />
    </div>
  );
};
