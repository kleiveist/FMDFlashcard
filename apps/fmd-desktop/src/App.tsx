import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type VaultFile = {
  path: string;
  relative_path: string;
};

type TabKey = "dashboard" | "settings";

type LoadState = "idle" | "loading" | "error";

type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[];
  fullPath?: string;
};

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

const FolderIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

const FileIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M14 4v5h5" />
  </svg>
);

const normalizeRelativePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\/+/, "");

const buildTree = (files: VaultFile[]): TreeNode[] => {
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

const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((node) => {
    if (node.type === "dir" && node.children) {
      return { ...node, children: sortNodes(node.children) };
    }
    return node;
  });
};

const vaultBaseName = (value: string | null) => {
  if (!value) {
    return "Vault";
  }
  const trimmed = value.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || "Vault";
};

const asErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [preview, setPreview] = useState("");
  const [listState, setListState] = useState<LoadState>("idle");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [listError, setListError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [treeSelection, setTreeSelection] = useState<string | null>(null);

  const fileCountLabel = useMemo(() => {
    if (!vaultPath) {
      return "Kein Vault gewaehlt";
    }
    if (files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${files.length} Markdown-Datei${files.length === 1 ? "" : "en"}`;
  }, [files.length, vaultPath]);

  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const treeNodes = useMemo(() => buildTree(files), [files]);

  const persistVaultPath = useCallback(async (path: string | null) => {
    try {
      await invoke("save_vault_path", { vaultPath: path });
      return true;
    } catch (error) {
      console.error("Failed to save vault path", error);
      return false;
    }
  }, []);

  const loadVault = useCallback(
    async (
      path: string,
      options: {
        persist: boolean;
        clearOnFailure?: boolean;
        errorMessage?: string;
      },
    ) => {
      setListError("");
      setPreviewError("");
      setVaultPath(path);
      setSelectedFile(null);
      setTreeSelection(null);
      setPreview("");
      setFiles([]);
      setListState("loading");
      try {
        const results = await invoke<VaultFile[]>("list_markdown_files", {
          vaultPath: path,
        });
        setFiles(results);
        setListState("idle");
        if (options.persist) {
          await persistVaultPath(path);
        }
        return true;
      } catch (error) {
        const message = asErrorMessage(error, "Failed to list markdown files.");
        setListError(options.errorMessage ?? message);
        setListState("error");
        if (options.clearOnFailure) {
          setVaultPath(null);
          await persistVaultPath(null);
        }
        return false;
      }
    },
    [persistVaultPath],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreVault = async () => {
      try {
        const storedPath = await invoke<string | null>("load_vault_path");
        if (!storedPath || cancelled) {
          return;
        }
        await loadVault(storedPath, {
          persist: false,
          clearOnFailure: true,
          errorMessage:
            "Gespeicherter Vault ist nicht verfuegbar. Bitte neu auswaehlen.",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = asErrorMessage(
          error,
          "Gespeicherte Einstellungen konnten nicht geladen werden.",
        );
        setListError(message);
        setListState("error");
      }
    };

    void restoreVault();

    return () => {
      cancelled = true;
    };
  }, [loadVault]);

  const handlePickVault = async () => {
    setListError("");
    setPreviewError("");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Vault auswaehlen",
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    await loadVault(selected, { persist: true });
  };

  const handleSelectFile = async (file: VaultFile) => {
    setSelectedFile(file);
    setPreview("");
    setPreviewError("");
    setPreviewState("loading");
    try {
      const contents = await invoke<string>("read_text_file", {
        path: file.path,
      });
      setPreview(contents);
      setPreviewState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Failed to load file contents.");
      setPreviewError(message);
      setPreviewState("error");
    }
  };

  const renderTreeNodes = (nodes: TreeNode[]) =>
    nodes.map((node) => {
      if (node.type === "dir") {
        return (
          <details className="tree-dir" key={node.path}>
            <summary className="tree-item">
              <span className="tree-icon">
                <FolderIcon />
              </span>
              <span className="tree-name">{node.name}</span>
            </summary>
            <div className="tree-children">{renderTreeNodes(node.children ?? [])}</div>
          </details>
        );
      }

      return (
        <button
          type="button"
          key={node.path}
          className={`tree-item tree-file ${
            treeSelection === node.path ? "active" : ""
          }`}
          onClick={() => setTreeSelection(node.path)}
          title={node.path}
        >
          <span className="tree-icon">
            <FileIcon />
          </span>
          <span className="tree-name">{node.name}</span>
        </button>
      );
    });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FMD</div>
          <div className="brand-text">
            <span className="brand-title">FMD Flashcard</span>
            <span className="brand-sub">Vault-first study workspace</span>
          </div>
        </div>
        <nav className="nav">
          <button
            type="button"
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="vault-status">
            <span className="label">Vault</span>
            <span className="value">{vaultPath ? "Aktiv" : "Nicht gesetzt"}</span>
          </div>
          <button
            type="button"
            className={`nav-icon ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            aria-label="Einstellungen"
            title="Einstellungen"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <circle cx="9" cy="6" r="2.5" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <circle cx="14" cy="12" r="2.5" />
              <line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="11" cy="18" r="2.5" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="content">
        {activeTab === "dashboard" ? (
          <>
            <header className="content-header">
              <div>
                <p className="eyebrow">Dashboard</p>
                <h1>Vault Uebersicht</h1>
                <p className="muted">
                  Waehle einen Vault, scanne Markdown-Dateien und sieh dir Inhalte
                  sofort an.
                </p>
              </div>
            </header>

            <details className="vault-details">
              <summary>
                <span>Datenverzeichnis</span>
                <span className="vault-summary">{fileCountLabel}</span>
              </summary>
              <div className="vault-body">
                {!vaultPath ? (
                  <div className="empty-state">
                    Waehle einen Vault, um das Verzeichnis anzuzeigen.
                  </div>
                ) : null}
                {listState === "loading" ? (
                  <span className="chip">Scanne...</span>
                ) : null}
                {listState === "error" ? (
                  <div className="error">{listError}</div>
                ) : null}
                {vaultPath && listState === "idle" && treeNodes.length === 0 ? (
                  <div className="empty-state">
                    Keine Markdown-Dateien in diesem Vault.
                  </div>
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

            <div className="workspace">
              <section className="panel list-panel">
                <div className="panel-header">
                  <div>
                    <h2>Notizen</h2>
                    <p className="muted">{fileCountLabel}</p>
                  </div>
                  {listState === "loading" ? (
                    <span className="chip">Scanne...</span>
                  ) : null}
                </div>
                <div className="panel-body">
                  {!vaultPath ? (
                    <div className="empty-state">
                      Waehle einen Vault, um die Liste zu fuellen.
                    </div>
                  ) : null}
                  {listState === "error" ? (
                    <div className="error">{listError}</div>
                  ) : null}
                  {vaultPath && listState === "idle" && files.length === 0 ? (
                    <div className="empty-state">
                      Keine Markdown-Dateien in diesem Vault.
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
                            onClick={() => handleSelectFile(file)}
                          >
                            <span className="file-name">{file.relative_path}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>

              <section className="panel preview-panel">
                <div className="panel-header">
                  <div>
                    <h2>Vorschau</h2>
                    <p className="muted">
                      {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
                    </p>
                  </div>
                  {previewState === "loading" ? (
                    <span className="chip">Lade...</span>
                  ) : null}
                </div>
                <div className="panel-body">
                  {previewState === "error" ? (
                    <div className="error">{previewError}</div>
                  ) : null}
                  <pre className="preview">
                    {preview || emptyPreview}
                  </pre>
                </div>
              </section>
            </div>
          </>
        ) : (
          <>
            <header className="content-header">
              <div>
                <p className="eyebrow">Settings</p>
                <h1>Einstellungen</h1>
                <p className="muted">
                  Passe deinen Workflow an. Die naechsten Features bauen auf dieser
                  Vault-Basis auf.
                </p>
              </div>
              <div className="actions">
                <button type="button" className="primary" onClick={handlePickVault}>
                  Vault auswaehlen
                </button>
              </div>
            </header>

            <div className="settings-grid">
              <section className="panel">
                <h2>Vault Status</h2>
                <p className="muted">
                  Aktiver Pfad wird hier gespeichert. Bald folgen Auto-Scan und
                  Watcher.
                </p>
                <div className="setting-row">
                  <span className="label">Aktueller Vault</span>
                  <span className="value path-value">
                    {vaultPath ?? "Nicht gesetzt"}
                  </span>
                </div>
              </section>
              <section className="panel">
                <h2>Naechste Schritte</h2>
                <p className="muted">
                  Parser, Karten-Generator und Sync werden als naechste vertikale
                  Scheiben ausgebaut.
                </p>
                <div className="pill-grid">
                  <span className="pill">Parser</span>
                  <span className="pill">Card Build</span>
                  <span className="pill">Vault Watcher</span>
                </div>
              </section>
              <section className="panel">
                <h2>Aktivitaet</h2>
                <p className="muted">
                  Zuletzt gelesene Datei und Import-Logs erscheinen hier.
                </p>
                <div className="setting-row">
                  <span className="label">Zuletzt</span>
                  <span className="value">
                    {selectedFile?.relative_path ?? "Noch nichts geladen"}
                  </span>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
