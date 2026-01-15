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
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { FileIcon, FolderIcon } from "./icons";
import { VaultCreateModal } from "./VaultCreateModal";
import { VaultDeleteModal } from "./VaultDeleteModal";
import { asErrorMessage } from "../lib/errors";
import { isHiddenPath, normalizeRelativePath, vaultBaseName } from "../lib/path";
import {
  buildTree,
  filterHiddenFiles,
  sortNodes,
  type TreeNode,
  type VaultFile,
} from "../lib/tree";
import { type LoadState } from "../lib/types";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";

const INDENT_STEP = 12;
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

const getIndentVars = (depth: number): CSSProperties =>
  ({
    "--tree-indent": `${depth * INDENT_STEP}px`,
    "--tree-overflow": `${Math.max(0, depth - OVERFLOW_DEPTH) * INDENT_STEP}px`,
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
  onRescanVault: () => void;
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
  showHiddenFolders: boolean;
  listError: string;
  listState: LoadState;
  onRescanVault: () => void;
  onActiveFolderChange: (path: string | null) => void;
  onTogglePath: (path: string, isOpen: boolean) => void;
  onSelectFile: (file: VaultFile) => void;
  onClearSelection?: () => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const VaultTree = ({
  activeFolderPath,
  expandedPaths,
  fileCountLabel,
  files,
  showHiddenFolders,
  listError,
  listState,
  onRescanVault,
  onActiveFolderChange,
  onTogglePath,
  onSelectFile,
  onClearSelection,
  selectedFile,
  vaultPath,
}: VaultTreeProps) => {
  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  const [extraDirs, setExtraDirs] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<VaultFile[]>([]);
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
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultFile | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
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

  const visibleFiles = useMemo(
    () => filterHiddenFiles(mergedFiles, showHiddenFolders),
    [mergedFiles, showHiddenFolders],
  );

  const treeNodes = useMemo(() => {
    const nodes = buildTree(visibleFiles);
    const visibleExtraDirs = showHiddenFolders
      ? extraDirs
      : extraDirs.filter((dirPath) => !isHiddenPath(dirPath));
    if (!visibleExtraDirs.length) {
      return nodes;
    }
    const nextNodes = [...nodes];
    visibleExtraDirs.forEach((dirPath) => {
      const normalized = normalizeRelativePath(dirPath);
      if (!normalized) {
        return;
      }
      const parts = normalized.split("/").filter(Boolean);
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
  }, [extraDirs, showHiddenFolders, visibleFiles]);
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
    setOpenError("");
    setDeleteTarget(null);
    setDeleteError("");
    setIsDeleting(false);
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
      setContextMenu({ target, x: event.clientX, y: event.clientY });
      setMenuStyle({ left: event.clientX, top: event.clientY });
    },
    [],
  );

  const reportOpenError = useCallback((message: string, details: Record<string, unknown>) => {
    setOpenError(message);
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

  const handleVaultKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!shouldHandleVaultDeleteShortcut(event)) {
        return;
      }
      if (!selectedFile) {
        return;
      }
      if (!isMarkdownFilePath(selectedFile.relative_path)) {
        setDeleteError("Only markdown files can be deleted.");
        return;
      }
      event.preventDefault();
      requestDelete(selectedFile);
    },
    [requestDelete, selectedFile],
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
  const menuDirPath =
    menuTarget?.kind === "file" ? menuTarget.dirPath : menuTarget?.path ?? "";
  const canDeleteFile = fileTarget
    ? isMarkdownFilePath(fileTarget.file.relative_path)
    : false;
  const deleteFileName = deleteTarget
    ? deleteTarget.relative_path.split("/").pop() ?? deleteTarget.relative_path
    : "";
  const rootFolderState = getFolderState("");
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
              }${hiddenClass}`}
              title={node.path}
              style={indentStyle}
              onClick={() => onActiveFolderChange(node.path)}
              onContextMenu={(event) => {
                onActiveFolderChange(node.path);
                openContextMenu(event, { kind: "dir", path: node.path });
              }}
            >
              <span className="tree-icon">
                <FolderIcon />
              </span>
              <span className="tree-name">{node.name}</span>
            </summary>
            <div className="tree-children">
              {renderTreeNodes(node.children ?? [], depth + 1)}
            </div>
          </details>
        );
      }

      const fileRef =
        node.file ??
        (node.fullPath ? { path: node.fullPath, relative_path: node.path } : null);
      const isActive = !!fileRef && selectedFile?.path === fileRef.path;

      return (
        <button
          type="button"
          key={node.path}
          className={`tree-item tree-file ${isActive ? "active" : ""}${hiddenClass}`}
          onClick={() => {
            if (!fileRef) {
              return;
            }
            onSelectFile(fileRef);
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
        <span>Vault Directory</span>
        <span className="vault-summary">{fileCountLabel}</span>
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
          {deleteError ? <div className="error">{deleteError}</div> : null}
          {vaultPath && listState === "idle" && treeNodes.length === 0 ? (
            <div className="empty-state">Keine Markdown-Dateien in diesem Vault.</div>
          ) : null}
          {vaultPath && listState === "idle" && treeNodes.length > 0 ? (
            <div className="vault-tree">
              <details className="tree-dir" open>
                <summary
                  className={`tree-item${
                    rootFolderState.isActiveFolder ? " active-folder" : ""
                  }${rootFolderState.isBreadcrumb ? " breadcrumb" : ""}`}
                  style={getIndentVars(0)}
                  onClick={() => onActiveFolderChange("")}
                  onContextMenu={(event) => {
                    onActiveFolderChange("");
                    openContextMenu(event, { kind: "dir", path: "" });
                  }}
                >
                  <span className="tree-icon">
                    <FolderIcon />
                  </span>
                  <span className="tree-name">{vaultRootName}</span>
                </summary>
                <div className="tree-children">
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
