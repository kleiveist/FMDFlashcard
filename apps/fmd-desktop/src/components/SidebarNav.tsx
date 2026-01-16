/**
 * @file apps/fmd-desktop/src/components/SidebarNav.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Sidebar Nav.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/lib/path.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/components/VaultTree.tsx: UI-Komponente.
 *
 * Exportiert:
 * - SidebarNav: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppState } from "./AppStateProvider";
import { normalizeRelativePath, normalizeVaultPath, vaultBaseName } from "../lib/path";
import { VaultTree } from "./VaultTree";
import {
  CardsIcon,
  CheckIcon,
  ChevronDownIcon,
  FolderIcon,
  HelpIcon,
  RefreshIcon,
  SettingsIcon,
} from "./icons";
import { DEFAULT_HELP_TOPIC_ID, helpTopics, resolveText } from "../pages/help/helpContent";
import { SETTINGS_PAGES } from "../features/settings/settingsNavigation";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import { useVaultPathInfo } from "../features/vault/useVaultPathInfo";

type TabKey =
  | "dashboard"
  | "exam"
  | "exam-editor"
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
  const [isVaultMenuOpen, setIsVaultMenuOpen] = useState(false);
  const vaultMenuRef = useRef<HTMLDivElement | null>(null);
  const vaultButtonRef = useRef<HTMLButtonElement | null>(null);
  const { activeSettingsPage, setActiveSettingsPage } = settingsNav;
  const isToolbarCollapsed = settings.rightToolbarCollapsed;
  const vaultRootName = useMemo(
    () => vaultBaseName(vault.vaultPath),
    [vault.vaultPath],
  );
  const refreshLabel = useMemo(() => {
    if (!vault.vaultPath || !vault.lastRefreshAt) {
      return "Rescan vault";
    }
    const formatted = new Date(vault.lastRefreshAt).toLocaleTimeString();
    return `Rescan vault (last: ${formatted})`;
  }, [vault.lastRefreshAt, vault.vaultPath]);
  const activeVaultKey = useMemo(
    () => normalizeVaultPath(vault.vaultPath ?? ""),
    [vault.vaultPath],
  );
  const recentVaults = settings.recentVaults ?? [];
  const recentVaultPaths = useMemo(
    () => recentVaults.map((entry) => entry.path),
    [recentVaults],
  );
  const recentVaultInfo = useVaultPathInfo(recentVaultPaths, isVaultMenuOpen);
  const isRescanningVault = vault.listState === "loading";
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
    activeTab === "exam" ||
    activeTab === "exam-editor" ||
    activeTab === "flashcard" ||
    activeTab === "fast-flashcard" ||
    activeTab === "spaced-repetition";
  const toggleLabel = isToolbarCollapsed ? "Expand toolbar" : "Collapse toolbar";
  const toggleSymbol = isToolbarCollapsed ? ">" : "<";
  const helpTopicOrder = [
    "app-sections",
    "structured-syntax",
    "flashcard-syntax",
    "vault",
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

  const handleVaultHelpClick = useCallback(
    (event?: MouseEvent<HTMLButtonElement>) => {
      event?.stopPropagation();
      setIsVaultMenuOpen(false);
      setToolbarMode("help");
      help.setActiveTopicId(DEFAULT_HELP_TOPIC_ID);
      onTabChange("help");
    },
    [help, onTabChange, setIsVaultMenuOpen, setToolbarMode],
  );

  useEffect(() => {
    if (!vault.activeFolderPath) {
      return;
    }
    const normalized = normalizeRelativePath(vault.activeFolderPath).replace(/\/+$/, "");
    if (!normalized) {
      return;
    }
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      const parts = normalized.split("/").filter(Boolean);
      let current = "";
      parts.forEach((part) => {
        current = current ? `${current}/${part}` : part;
        next.add(current);
      });
      return next;
    });
  }, [vault.activeFolderPath]);

  useEffect(() => {
    if (!isVaultMenuOpen) {
      return;
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (vaultMenuRef.current?.contains(target)) {
        return;
      }
      if (vaultButtonRef.current?.contains(target)) {
        return;
      }
      setIsVaultMenuOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isVaultMenuOpen]);

  useEffect(() => {
    if (!isVaultMenuOpen) {
      return;
    }
    return registerCloseLayer({
      id: "vault-recent-menu",
      priority: 200,
      isActive: () => isVaultMenuOpen,
      onClose: () => setIsVaultMenuOpen(false),
    });
  }, [isVaultMenuOpen]);

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
            <div className="vault-status">
              <button
                ref={vaultButtonRef}
                type="button"
                className="vault-status-main"
                onClick={() => setIsVaultMenuOpen((prev) => !prev)}
                title={vault.vaultPath ?? "Select vault"}
                aria-label="Select vault"
                aria-haspopup="menu"
                aria-expanded={isVaultMenuOpen}
                aria-controls="vault-recents-menu"
              >
                <span className="label">ACTIVE VAULT</span>
                <span className="value vault-status-value">
                  <span className="vault-status-value-text">
                    Vault: {vault.vaultPath ? vaultRootName : "Not set"}
                  </span>
                  <span
                    className={`vault-status-caret${
                      isVaultMenuOpen ? " is-open" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <ChevronDownIcon />
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="vault-status-refresh"
                onClick={() => void actions.handleRescanVault("sidebar:refresh-button")}
                title={refreshLabel}
                aria-label={refreshLabel}
                disabled={!vault.vaultPath || isRescanningVault}
              >
                <span
                  className={`vault-status-refresh-icon${
                    isRescanningVault ? " is-spinning" : ""
                  }`}
                >
                  <RefreshIcon />
                </span>
              </button>
              {isVaultMenuOpen ? (
                <div
                  ref={vaultMenuRef}
                  id="vault-recents-menu"
                  className="vault-status-menu"
                  role="menu"
                  aria-label="Recent vaults"
                >
                  {recentVaults.length === 0 ? (
                    <div className="vault-status-menu-empty muted">
                      No recent vaults.
                    </div>
                  ) : (
                    recentVaults.map((entry) => {
                      const info = recentVaultInfo[entry.path];
                      const isMissing = info ? !info.exists || !info.isDir : false;
                      const isActive =
                        normalizeVaultPath(entry.path) === activeVaultKey;
                      return (
                        <div className="vault-status-menu-row" key={entry.path}>
                          <button
                            type="button"
                            className="vault-status-menu-item"
                            role="menuitem"
                            disabled={isMissing}
                            onClick={() => {
                              setIsVaultMenuOpen(false);
                              if (isActive) {
                                return;
                              }
                              void actions.handleSwitchVault(entry.path);
                            }}
                            title={entry.path}
                          >
                            <span className="vault-status-menu-name">
                              {vaultBaseName(entry.path)}
                            </span>
                            {isMissing ? <span className="chip">Missing</span> : null}
                          </button>
                          <div className="vault-status-menu-actions">
                            {isActive ? (
                              <span
                                className="vault-status-menu-check"
                                aria-hidden="true"
                              >
                                <CheckIcon />
                              </span>
                            ) : null}
                            {isMissing ? (
                              <button
                                type="button"
                                className="vault-status-menu-remove"
                                onClick={() => actions.handleRemoveRecentVault(entry.path)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="vault-status-menu-divider" role="separator" />
                  <div className="vault-status-menu-manage-row">
                    <button
                      type="button"
                      className="vault-status-menu-item vault-status-menu-manage"
                      role="menuitem"
                      onClick={() => {
                        setIsVaultMenuOpen(false);
                        actions.handleOpenVaultManager();
                      }}
                    >
                      Manage Vaults
                    </button>
                    <button
                      type="button"
                      className="vault-status-menu-help"
                      onClick={handleVaultHelpClick}
                      aria-label="Help"
                      title="Help"
                    >
                      <HelpIcon />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="sidebar-icon-row">
              <button
                type="button"
                className={`nav-icon sidebar-icon-button ${
                  toolbarMode === "cards" ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("cards");
                  if (!isCardsTab) {
                    onTabChange("exam");
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
                className={`nav-item ${activeTab === "exam" ? "active" : ""}`}
                onClick={() => onTabChange("exam")}
              >
                Exam
              </button>
              <button
                type="button"
                className={`nav-item ${activeTab === "exam-editor" ? "active" : ""}`}
                onClick={() => onTabChange("exam-editor")}
              >
                Exam Editor
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
                activeFolderPath={vault.activeFolderPath}
                expandedPaths={expandedPaths}
                fileCountLabel={fileCountLabel}
                files={vault.files}
                showHiddenFolders={settings.showHiddenFolders}
                listError={vault.listError}
                listState={vault.listState}
                onActiveFolderChange={vault.setActiveFolderPath}
                onTogglePath={handleTogglePath}
                onSelectFile={actions.handleSelectFile}
                onRescanVault={actions.handleRescanVault}
                onClearSelection={preview.resetPreview}
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
