import { useMemo, useState } from "react";
import { useAppState } from "./AppStateProvider";
import { vaultBaseName } from "../lib/path";
import { VaultTree } from "./VaultTree";
import { CardsIcon, FolderIcon, HelpIcon, SettingsIcon } from "./icons";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard"
  | "help"
  | "settings";

type ToolbarMode = "cards" | "vault" | "settings" | "help";

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
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>("cards");
  const isToolbarCollapsed = settings.rightToolbarCollapsed;
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
  const isCollapsed = isToolbarCollapsed && !isMobileNavOpen;
  const isCardsTab =
    activeTab === "dashboard" ||
    activeTab === "flashcard" ||
    activeTab === "fast-flashcard" ||
    activeTab === "spaced-repetition";
  const toggleLabel = isToolbarCollapsed ? "Expand toolbar" : "Collapse toolbar";
  const toggleSymbol = isToolbarCollapsed ? ">" : "<";

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${isCollapsed ? "collapsed" : ""}`}
      aria-label="Primary navigation"
    >
      <button
        type="button"
        className="sidebar-handle"
        onClick={() => settings.setRightToolbarCollapsed((prev) => !prev)}
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        <span className="sidebar-handle-chevron" aria-hidden="true">
          {toggleSymbol}
        </span>
      </button>
      {isCollapsed ? null : (
        <>
          <div className="sidebar-head">
            <button
              type="button"
              className="mobile-nav-close"
              onClick={onMobileNavClose}
              aria-label="Close navigation"
            >
              Close
            </button>
            <button
              type="button"
              className="vault-status"
              onClick={actions.handlePickVault}
              title={vault.vaultPath ?? "Select vault"}
              aria-label="Select vault"
            >
              <span className="label">Active Vault</span>
              <span className="value">
                Vault: {vault.vaultPath ? vaultRootName : "Not set"}
              </span>
            </button>
            <div className="sidebar-icon-row">
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "cards" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("cards");
                  if (!isCardsTab) {
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
                  toolbarMode === "settings" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("settings");
                  onTabChange("settings");
                }}
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon />
              </button>
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "help" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("help");
                  onTabChange("help");
                }}
                aria-label="Help"
                title="Help"
              >
                <HelpIcon />
              </button>
            </div>
            <div
              className="sidebar-divider sidebar-divider-muted"
              aria-hidden="true"
            />
          </div>
          {toolbarMode === "cards" ? (
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
          {toolbarMode === "settings" ? (
            <div className="sidebar-mode-panel">
              <div className="sidebar-card">
                <span className="label">Settings</span>
                <span className="value">Tune your workspace</span>
                <p className="muted">
                  Adjust study flow, vault scanning, and performance options.
                </p>
              </div>
            </div>
          ) : null}
          {toolbarMode === "help" ? (
            <div className="sidebar-mode-panel">
              <div className="sidebar-card">
                <span className="label">Help</span>
                <span className="value">Quick reminders</span>
                <p className="muted">
                  Keep sessions short. Review daily. Trust repetition.
                </p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
};
