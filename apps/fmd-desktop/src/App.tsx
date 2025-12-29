import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type VaultFile = {
  path: string;
  relative_path: string;
};

type TabKey = "dashboard" | "settings";

type LoadState = "idle" | "loading" | "error";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

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

  const fileCountLabel = useMemo(() => {
    if (!vaultPath) {
      return "Kein Vault gewaehlt";
    }
    if (files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${files.length} Markdown-Datei${files.length === 1 ? "" : "en"}`;
  }, [files.length, vaultPath]);

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

    setVaultPath(selected);
    setSelectedFile(null);
    setPreview("");
    setFiles([]);
    setListState("loading");
    try {
      const results = await invoke<VaultFile[]>("list_markdown_files", {
        vault_path: selected,
      });
      setFiles(results);
      setListState("idle");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to list markdown files.";
      setListError(message);
      setListState("error");
    }
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
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to load file contents.";
      setPreviewError(message);
      setPreviewState("error");
    }
  };

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
          <button
            type="button"
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Einstellungen
          </button>
        </nav>
        <div className="sidebar-card">
          <span className="label">Vault</span>
          <span className="value">{vaultPath ? "Aktiv" : "Nicht gesetzt"}</span>
          <span className="path" title={vaultPath ?? undefined}>
            {vaultPath ?? "Vault auswaehlen, um zu starten"}
          </span>
        </div>
        <button type="button" className="ghost" onClick={handlePickVault}>
          Vault auswaehlen
        </button>
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
              <div className="actions">
                <button type="button" className="primary" onClick={handlePickVault}>
                  Vault auswaehlen
                </button>
              </div>
            </header>

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
                  <span className="value">{vaultPath ?? "Nicht gesetzt"}</span>
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
