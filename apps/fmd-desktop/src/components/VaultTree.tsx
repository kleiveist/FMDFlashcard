import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { FileIcon, FolderIcon } from "./icons";
import { VaultCreateModal } from "./VaultCreateModal";
import { asErrorMessage } from "../lib/errors";
import { normalizeRelativePath, vaultBaseName } from "../lib/path";
import {
  buildTree,
  sortNodes,
  type TreeNode,
  type VaultFile,
} from "../lib/tree";
import { type LoadState } from "../lib/types";

const INDENT_STEP = 12;
const OVERFLOW_DEPTH = 4;
const DEFAULT_FILE_NAME = "New Note.md";
const DEFAULT_FOLDER_NAME = "New Folder";
const NAME_FORBIDDEN_PATTERN = /[\\/]/;

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

const findDirectoryNode = (nodes: TreeNode[], path: string): TreeNode | null => {
  if (!path) {
    return { name: "__root__", path: "", type: "dir", children: nodes };
  }
  const parts = normalizeRelativePath(path).split("/").filter(Boolean);
  let current: TreeNode | null = { name: "__root__", path: "", type: "dir", children: nodes };
  let currentPath = "";
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const next =
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

type ContextMenuTarget =
  | { kind: "file"; file: VaultFile; dirPath: string }
  | { kind: "dir"; path: string }
  | { kind: "empty"; path: string };

type VaultTreeProps = {
  activeFolderPath: string | null;
  expandedPaths: Set<string>;
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onRescanVault: () => void;
  onActiveFolderChange: (path: string | null) => void;
  onTogglePath: (path: string, isOpen: boolean) => void;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const VaultTree = ({
  activeFolderPath,
  expandedPaths,
  fileCountLabel,
  files,
  listError,
  listState,
  onRescanVault,
  onActiveFolderChange,
  onTogglePath,
  onSelectFile,
  selectedFile,
  vaultPath,
}: VaultTreeProps) => {
  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const [extraDirs, setExtraDirs] = useState<string[]>([]);
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
  const [isCreating, setIsCreating] = useState(false);

  const treeNodes = useMemo(() => {
    const nodes = buildTree(files);
    if (!extraDirs.length) {
      return nodes;
    }
    const nextNodes = [...nodes];
    extraDirs.forEach((dirPath) => {
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
  }, [extraDirs, files]);
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
    onActiveFolderChange(null);
    setContextMenu(null);
  }, [onActiveFolderChange, vaultPath]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu]);

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
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

  const handleOpenDataFolder = useCallback(
    async (dirPath: string) => {
      if (!vaultPath) {
        return;
      }
      try {
        await openPath(joinVaultPath(vaultPath, dirPath));
      } catch (error) {
        console.error("Failed to open folder", error);
      }
    },
    [vaultPath],
  );

  const handleOpenWithDefault = useCallback(async (file: VaultFile) => {
    try {
      await openPath(file.path);
    } catch (error) {
      console.error("Failed to open file", error);
    }
  }, []);

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
  const menuDirPath = fileTarget ? fileTarget.dirPath : menuTarget?.path ?? "";
  const rootFolderState = getFolderState("");

  const renderTreeNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const indentStyle = getIndentVars(depth);
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
              }`}
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
          className={`tree-item tree-file ${isActive ? "active" : ""}`}
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
        >
          {!vaultPath ? (
            <div className="empty-state">
              Select a vault to view the directory.
            </div>
          ) : null}
          {listState === "loading" ? <span className="chip">Scanne...</span> : null}
          {listError ? <div className="error">{listError}</div> : null}
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
      {contextMenu ? (
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
                    closeContextMenu();
                    void handleOpenDataFolder(menuDirPath);
                  }}
                >
                  Open Data Folder
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    closeContextMenu();
                    void handleOpenWithDefault(fileTarget.file);
                  }}
                >
                  Open with Default
                </button>
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
                    closeContextMenu();
                    void handleOpenDataFolder(menuDirPath);
                  }}
                >
                  Open Data Folder
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
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
