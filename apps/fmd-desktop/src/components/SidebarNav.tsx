import { useMemo, useState } from "react";
import { useAppState } from "./AppStateProvider";
import { vaultBaseName } from "../lib/path";
import { VaultTree } from "./VaultTree";
import { CardsIcon, FolderIcon, PlaceholderIcon } from "./icons";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard"
  | "help"
  | "settings";

type ToolbarMode = "nav" | "vault" | "placeholder";

type SidebarNavProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  isMobileNavOpen: boolean;
  onMobileNavClose: () => void;
};

export const SidebarNav = ({
  activeTab,
  onTabChange,
  isMobileNavOpen,
  onMobileNavClose,
}: SidebarNavProps) => {
  const { actions, preview, settings, vault } = useAppState();
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>("nav");
  const vaultRootName = useMemo(
    () => vaultBaseName(vault.vaultPath),
    [vault.vaultPath],
  );
  const fileCountLabel = useMemo(() => {
    if (!vault.vaultPath) {
      return "No vault selected";
    }
    if (vault.files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${vault.files.length} Markdown-Datei${
      vault.files.length === 1 ? "" : "en"
    }`;
  }, [vault.files.length, vault.vaultPath]);
  const isCollapsed = settings.rightToolbarCollapsed && !isMobileNavOpen;
  const isNavTab =
    activeTab === "dashboard" ||
    activeTab === "flashcard" ||
    activeTab === "fast-flashcard" ||
    activeTab === "spaced-repetition";

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${isCollapsed ? "collapsed" : ""}`}
      aria-label="Primary navigation"
    >
      {isCollapsed ? (
        <button
          type="button"
          className="sidebar-rail"
          onClick={() => settings.setRightToolbarCollapsed(false)}
          aria-label="Expand toolbar"
        >
          <span className="rail-arrow">&gt;</span>
        </button>
      ) : (
        <>
          <div className="sidebar-head">
            <div className="sidebar-divider" aria-hidden="true" />
            <div className="sidebar-icon-row">
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "nav" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("nav");
                  if (!isNavTab) {
                    onTabChange("flashcard");
                  }
                }}
                aria-label="Study flashcards"
                title="Study"
              >
                <CardsIcon />
              </button>
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "vault" ? "active" : ""
                }`}
                onClick={() => setToolbarMode("vault")}
                aria-label="Vault directory"
                aria-controls="sidebar-vault-panel"
                aria-expanded={toolbarMode === "vault"}
                title="Vault directory"
              >
                <FolderIcon />
              </button>
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "placeholder" ? "active" : ""
                }`}
                onClick={() => setToolbarMode("placeholder")}
                aria-label="Dashboard placeholder"
                title="Placeholder"
              >
                <PlaceholderIcon />
              </button>
            </div>
            <div
              className="sidebar-divider sidebar-divider-muted"
              aria-hidden="true"
            />
            <div className="brand">
              <button
                type="button"
                className="brand-mark"
                onClick={() => settings.setRightToolbarCollapsed(true)}
                aria-label="Collapse toolbar"
              >
                FMD
              </button>
              <div className="brand-text">
                <span className="brand-title">FMD Flashcard</span>
                <span className="brand-sub">Vault-first study workspace</span>
              </div>
              <button
                type="button"
                className="mobile-nav-close"
                onClick={onMobileNavClose}
                aria-label="Close navigation"
              >
                Close
              </button>
            </div>
          </div>
          {toolbarMode === "nav" ? (
            <nav className="nav">
              <button
                type="button"
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => onTabChange("dashboard")}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={`nav-item ${activeTab === "flashcard" ? "active" : ""}`}
                onClick={() => onTabChange("flashcard")}
              >
                Flashcard
              </button>
              <button
                type="button"
                className={`nav-item ${
                  activeTab === "fast-flashcard" ? "active" : ""
                }`}
                onClick={() => onTabChange("fast-flashcard")}
              >
                Fast Flashcard
              </button>
              <button
                type="button"
                className={`nav-item ${
                  activeTab === "spaced-repetition" ? "active" : ""
                }`}
                onClick={() => onTabChange("spaced-repetition")}
              >
                Spaced Repetition
              </button>
            </nav>
          ) : null}
          {toolbarMode === "vault" ? (
            <div className="sidebar-vault-panel" id="sidebar-vault-panel">
              <VaultTree
                fileCountLabel={fileCountLabel}
                files={vault.files}
                listError={vault.listError}
                listState={vault.listState}
                onSelectFile={actions.handleSelectFile}
                selectedFile={preview.selectedFile}
                vaultPath={vault.vaultPath}
                forceOpen
              />
            </div>
          ) : null}
          {toolbarMode === "placeholder" ? (
            <div className="sidebar-placeholder-panel">
              <div className="sidebar-card placeholder-card">
                <div className="placeholder-orbit" aria-hidden="true" />
                <span className="placeholder-title">Dashboard (Placeholder)</span>
                <p className="placeholder-copy">
                  Keep sessions short. Review daily. Trust repetition.
                </p>
                <span className="placeholder-hint">
                  A calm focus hub lands here soon.
                </span>
              </div>
            </div>
          ) : null}
          <div className="sidebar-footer">
            <button
              type="button"
              className="vault-status"
              onClick={actions.handlePickVault}
              title={vault.vaultPath ?? "Vault auswaehlen"}
              aria-label="Vault auswaehlen"
            >
              <span className="label">Aktiver Vault</span>
              <span className="value">
                Vault: {vault.vaultPath ? vaultRootName : "Nicht gesetzt"}
              </span>
            </button>
            <div className="sidebar-footer-actions">
              <button
                type="button"
                className={`nav-item nav-item-help ${
                  activeTab === "help" ? "active" : ""
                }`}
                onClick={() => onTabChange("help")}
              >
                <span>Help</span>
                <span className="nav-subtext">
                  Quick reminders for this workflow.
                </span>
              </button>
              <button
                type="button"
                className={`nav-icon ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => onTabChange("settings")}
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
          </div>
        </>
      )}
    </aside>
  );
};
