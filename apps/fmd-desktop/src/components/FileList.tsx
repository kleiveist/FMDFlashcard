/**
 * @file apps/fmd-desktop/src/components/FileList.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente File List.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - FileList: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";
import { asErrorMessage } from "../lib/errors";
import { normalizeRelativePath } from "../lib/path";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import {
  buildVaultDeleteHandlers,
  shouldHandleVaultDeleteShortcut,
} from "./VaultTree";
import { VaultCreateModal } from "./VaultCreateModal";
import { VaultDeleteModal } from "./VaultDeleteModal";

const DEFAULT_FILE_NAME = "New Note.md";
const NAME_FORBIDDEN_PATTERN = /[\\/]/;

const normalizeNewName = (value: string) => value.trim();

const ensureMarkdownExtension = (value: string) =>
  /\.md$/i.test(value) ? value : `${value}.md`;

const ensureUniqueName = (value: string, existing: Set<string>) => {
  const trimmed = normalizeNewName(value);
  const base = trimmed.replace(/\.md$/i, "");
  let candidate = ensureMarkdownExtension(trimmed);
  let index = 2;
  while (existing.has(candidate.toLowerCase())) {
    candidate = `${base} (${index}).md`;
    index += 1;
  }
  return candidate;
};

const normalizeFolderPath = (value: string | null) =>
  normalizeRelativePath(value ?? "").replace(/\/+$/, "");

const getParentRelativePath = (value: string) => {
  const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return "";
  }
  return normalized.slice(0, lastSlash);
};

const getFileName = (value: string) => {
  const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return normalized;
  }
  return normalized.slice(lastSlash + 1);
};

const getChildNameSet = (files: VaultFile[], dirPath: string) => {
  const names = new Set<string>();
  const normalizedDir = normalizeFolderPath(dirPath);
  files.forEach((file) => {
    const parent = getParentRelativePath(file.relative_path);
    if (normalizeFolderPath(parent) === normalizedDir) {
      const name = getFileName(file.relative_path).trim().toLowerCase();
      if (name) {
        names.add(name);
      }
    }
  });
  return names;
};

type FileListProps = {
  activeFolderPath: string | null;
  fileCountLabel: string;
  files: VaultFile[];
  isCollapsed: boolean;
  listError: string;
  listState: LoadState;
  onClearSelection?: () => void;
  onRescanVault?: (source?: string) => Promise<boolean>;
  onSelectFile: (file: VaultFile) => void;
  onToggleCollapsed: () => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const FileList = ({
  activeFolderPath,
  fileCountLabel,
  files,
  isCollapsed,
  listError,
  listState,
  onClearSelection,
  onRescanVault,
  onSelectFile,
  onToggleCollapsed,
  selectedFile,
  vaultPath,
}: FileListProps) => {
  const [contextMenu, setContextMenu] = useState<{
    target: { kind: "file"; file: VaultFile } | { kind: "empty" };
    x: number;
    y: number;
  } | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [createName, setCreateName] = useState(DEFAULT_FILE_NAME);
  const [createError, setCreateError] = useState("");
  const [createDirPath, setCreateDirPath] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultFile | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    return registerCloseLayer({
      id: "note-context-menu",
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
    (event: MouseEvent, target: { kind: "file"; file: VaultFile } | { kind: "empty" }) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ target, x: event.clientX, y: event.clientY });
      setMenuStyle({ left: event.clientX, top: event.clientY });
    },
    [],
  );

  const resolveCreateDirPath = useCallback(
    (target: { kind: "file"; file: VaultFile } | { kind: "empty" }) => {
      if (target.kind === "file") {
        return getParentRelativePath(target.file.relative_path);
      }
      const normalizedActiveFolder = normalizeFolderPath(activeFolderPath);
      if (normalizedActiveFolder) {
        return normalizedActiveFolder;
      }
      return selectedFile ? getParentRelativePath(selectedFile.relative_path) : "";
    },
    [activeFolderPath, selectedFile],
  );

  const openCreateModal = useCallback(
    (target: { kind: "file"; file: VaultFile } | { kind: "empty" }) => {
      setCreateDirPath(resolveCreateDirPath(target));
      setCreateName(DEFAULT_FILE_NAME);
      setCreateError("");
      setIsCreateOpen(true);
      setContextMenu(null);
    },
    [resolveCreateDirPath],
  );

  const handleCreateConfirm = useCallback(async () => {
    if (!vaultPath) {
      setCreateError("No active vault selected.");
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
    const preparedName = ensureMarkdownExtension(trimmed);
    const baseName = preparedName.replace(/\.md$/i, "").trim();
    if (!baseName) {
      setCreateError("Name is required.");
      return;
    }
    const existingNames = getChildNameSet(files, createDirPath);
    const uniqueName = ensureUniqueName(preparedName, existingNames);
    const relativePath = createDirPath ? `${createDirPath}/${uniqueName}` : uniqueName;
    setIsCreating(true);
    setCreateError("");
    try {
      const created = await invoke<VaultFile>("create_markdown_file", {
        vaultPath,
        relativePath,
      });
      onSelectFile(created);
      if (onRescanVault) {
        void onRescanVault("note-list:create");
      }
      setIsCreateOpen(false);
      setCreateName(DEFAULT_FILE_NAME);
      setCreateDirPath("");
    } catch (error) {
      setCreateError(asErrorMessage(error, "Failed to create file."));
    } finally {
      setIsCreating(false);
    }
  }, [createDirPath, createName, files, onRescanVault, onSelectFile, vaultPath]);

  const handleCreateCancel = useCallback(() => {
    if (isCreating) {
      return;
    }
    setIsCreateOpen(false);
    setCreateName(DEFAULT_FILE_NAME);
    setCreateError("");
    setCreateDirPath("");
  }, [isCreating]);

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

  const invokeDelete = useCallback(
    (vaultRoot: string, relativePath: string) =>
      invoke<void>("delete_markdown_file", { vaultPath: vaultRoot, relativePath }),
    [],
  );

  const handleRescan = useCallback(
    (source?: string) => (onRescanVault ? onRescanVault(source) : Promise.resolve(false)),
    [onRescanVault],
  );

  const { handleCancel: handleDeleteCancel, handleConfirm: handleDeleteConfirm } =
    useMemo(
      () =>
        buildVaultDeleteHandlers({
          vaultPath,
          deleteTarget,
          selectedFile,
          isDeleting,
          invokeDelete,
          onRescanVault: handleRescan,
          onClose: closeDeleteModal,
          onClearSelection,
          setError: setDeleteError,
          setIsDeleting,
        }),
      [
        closeDeleteModal,
        deleteTarget,
        handleRescan,
        invokeDelete,
        isDeleting,
        onClearSelection,
        selectedFile,
        vaultPath,
      ],
    );

  const handleNoteKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!shouldHandleVaultDeleteShortcut(event)) {
        return;
      }
      if (!selectedFile) {
        return;
      }
      event.preventDefault();
      requestDelete(selectedFile);
    },
    [requestDelete, selectedFile],
  );

  const menuTarget = contextMenu?.target ?? null;
  const fileTarget = menuTarget?.kind === "file" ? menuTarget.file : null;
  const portalTarget = typeof document === "undefined" ? null : document.body;
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
          onClick={() => openCreateModal(contextMenu.target)}
          disabled={!vaultPath}
        >
          New file
        </button>
        {fileTarget ? (
          <button
            type="button"
            className="context-menu-item"
            onClick={() => requestDelete(fileTarget)}
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <section
      className={`panel list-panel note-panel ${isCollapsed ? "is-collapsed" : ""}`}
      onKeyDown={handleNoteKeyDown}
    >
      {isCollapsed ? (
        <button
          type="button"
          className="panel-header note-toggle note-handle"
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
          aria-controls="note-panel-body"
          aria-label="Expand Note panel"
        >
          <span className="note-handle-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="panel-header note-toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
          aria-controls="note-panel-body"
          aria-label="Collapse Note panel"
        >
          <span className="note-heading">
            <span className="note-title">Note</span>
            <span className="muted note-meta">{fileCountLabel}</span>
          </span>
          {listState === "loading" ? (
            <span className="chip note-meta">Scanne...</span>
          ) : null}
        </button>
      )}
      <div
        className="panel-body"
        id="note-panel-body"
        hidden={isCollapsed}
        aria-hidden={isCollapsed}
        tabIndex={0}
        onContextMenu={(event) => openContextMenu(event, { kind: "empty" })}
      >
        {!vaultPath ? (
          <div className="empty-state">Waehle einen Vault, um die Liste zu fuellen.</div>
        ) : null}
        {listError ? <div className="error">{listError}</div> : null}
        {vaultPath && listState === "idle" && files.length === 0 ? (
          <div className="empty-state">
            {activeFolderPath
              ? "Keine Markdown-Dateien in diesem Ordner."
              : "Keine Markdown-Dateien in diesem Vault."}
          </div>
        ) : null}
        {vaultPath && listState !== "error" ? (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  className={`file-item ${
                    selectedFile?.path === file.path ? "active" : ""
                  }`}
                  onClick={() => onSelectFile(file)}
                  onContextMenu={(event) =>
                    openContextMenu(event, { kind: "file", file })
                  }
                >
                  <span className="file-name">{file.relative_path}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <VaultCreateModal
        isOpen={isCreateOpen}
        kind="file"
        name={createName}
        error={createError}
        isPending={isCreating}
        onNameChange={setCreateName}
        onCancel={handleCreateCancel}
        onConfirm={handleCreateConfirm}
      />
      <VaultDeleteModal
        isOpen={Boolean(deleteTarget)}
        fileName={deleteTarget?.relative_path.split("/").pop() ?? ""}
        error={deleteError}
        isPending={isDeleting}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
      {contextMenuLayer
        ? portalTarget
          ? createPortal(contextMenuLayer, portalTarget)
          : contextMenuLayer
        : null}
    </section>
  );
};
