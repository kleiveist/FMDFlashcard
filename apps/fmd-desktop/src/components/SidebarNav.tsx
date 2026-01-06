import { useMemo, useState } from "react";
import { useAppState } from "./AppStateProvider";
import { vaultBaseName } from "../lib/path";
import { VaultTree } from "./VaultTree";
import { CardsIcon, FolderIcon, HelpIcon, SettingsIcon } from "./icons";
import { helpTopics, resolveText } from "../pages/help/helpContent";
import { SETTINGS_PAGES } from "../features/settings/settingsNavigation";

type TabKey =
  | "dashboard"
  | "exam"
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
  const { actions, help, preview, settings, settingsNav, vault } = useAppState();
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>("cards");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const { activeSettingsPage, setActiveSettingsPage } = settingsNav;
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
    activeTab === "exam" ||
    activeTab === "flashcard" ||
    activeTab === "fast-flashcard" ||
    activeTab === "spaced-repetition";
  const toggleLabel = isToolbarCollapsed ? "Expand toolbar" : "Collapse toolbar";
  const toggleSymbol = isToolbarCollapsed ? ">" : "<";
  const helpTopicOrder = [
    "flashcard-syntax",
    "app-sections",
    "settings",
    "advanced",
    "vault",
    "extras",
  ];
  const helpNavTopics = helpTopicOrder
    .map((id) => helpTopics.find((topic) => topic.id === id))
    .filter((topic): topic is (typeof helpTopics)[number] => Boolean(topic));
  const handleTogglePath = (path: string, isOpen: boolean) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (isOpen) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

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
                onClick={() => {
                  setToolbarMode("vault");
                  if (activeTab !== "dashboard") {
                    onTabChange("dashboard");
                  }
                }}
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
                Makedon
              </button>
              <button
                type="button"
                className={`nav-item ${activeTab === "exam" ? "active" : ""}`}
                onClick={() => onTabChange("exam")}
              >
                Exam
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
                expandedPaths={expandedPaths}
                fileCountLabel={fileCountLabel}
                files={vault.files}
                listError={vault.listError}
                listState={vault.listState}
                onTogglePath={handleTogglePath}
                onSelectFile={actions.handleSelectFile}
                onRescanVault={actions.handleRescanVault}
                selectedFile={preview.selectedFile}
                vaultPath={vault.vaultPath}
              />
            </div>
          ) : null}
          {toolbarMode === "settings" ? (
            <>
              <nav className="nav settings-nav" aria-label="Settings pages">
                {SETTINGS_PAGES.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={`nav-item ${
                      activeSettingsPage === page.id ? "active" : ""
                    }`}
                    aria-pressed={activeSettingsPage === page.id}
                    aria-controls={`settings-page-${page.id}`}
                    onClick={() => {
                      setActiveSettingsPage(page.id);
                      if (activeTab !== "settings") {
                        onTabChange("settings");
                      }
                    }}
                  >
                    {page.label}
                  </button>
                ))}
              </nav>
            </>
          ) : null}
          {toolbarMode === "help" ? (
            <nav className="nav">
              {helpNavTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={`nav-item ${
                    help.activeTopicId === topic.id ? "active" : ""
                  }`}
                  onClick={() => {
                    help.setActiveTopicId(topic.id);
                    onTabChange("help");
                  }}
                >
                  {resolveText(topic.title, settings.language)}
                </button>
              ))}
            </nav>
          ) : null}
        </>
      )}
    </aside>
  );
};
