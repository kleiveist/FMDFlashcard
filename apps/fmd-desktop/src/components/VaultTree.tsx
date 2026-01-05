import { useMemo } from "react";
import { FileIcon, FolderIcon } from "./icons";
import { vaultBaseName } from "../lib/path";
import { buildTree, type TreeNode, type VaultFile } from "../lib/tree";
import { type LoadState } from "../lib/types";

type VaultTreeProps = {
  expandedPaths: Set<string>;
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onTogglePath: (path: string, isOpen: boolean) => void;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
  forceOpen?: boolean;
};

export const VaultTree = ({
  expandedPaths,
  fileCountLabel,
  files,
  listError,
  listState,
  onTogglePath,
  onSelectFile,
  selectedFile,
  vaultPath,
  forceOpen,
}: VaultTreeProps) => {
  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const treeNodes = useMemo(() => buildTree(files), [files]);

  const renderTreeNodes = (nodes: TreeNode[]) =>
    nodes.map((node) => {
      if (node.type === "dir") {
        const isOpen = expandedPaths.has(node.path);
        return (
          <details
            className="tree-dir"
            key={node.path}
            open={isOpen}
            onToggle={(event) => {
              onTogglePath(node.path, event.currentTarget.open);
            }}
          >
            <summary className="tree-item" title={node.path}>
              <span className="tree-icon">
                <FolderIcon />
              </span>
              <span className="tree-name">{node.name}</span>
            </summary>
            <div className="tree-children">{renderTreeNodes(node.children ?? [])}</div>
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
          onClick={() => fileRef && onSelectFile(fileRef)}
          title={node.path}
          disabled={!fileRef}
        >
          <span className="tree-icon">
            <FileIcon />
          </span>
          <span className="tree-name">{node.name}</span>
        </button>
      );
    });

  return (
    <details className="vault-details" open={forceOpen || undefined}>
      <summary>
        <span>Vault Directory</span>
        <span className="vault-summary">{fileCountLabel}</span>
      </summary>
      <div className="vault-body">
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
              <summary className="tree-item">
                <span className="tree-icon">
                  <FolderIcon />
                </span>
                <span className="tree-name">{vaultRootName}</span>
              </summary>
              <div className="tree-children">{renderTreeNodes(treeNodes)}</div>
            </details>
          </div>
        ) : null}
      </div>
    </details>
  );
};
