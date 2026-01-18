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
  type CSSProperties,
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
  ExamEditorIcon,
  FolderIcon,
  HelpIcon,
  RefreshIcon,
  SettingsIcon,
} from "./icons";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import { useVaultPathInfo } from "../features/vault/useVaultPathInfo";
import type { DashboardView } from "../pages/DashboardPage";

type TabKey =
  | "dashboard"
  | "exam"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard";

type ToolbarMode = "cards" | "vault";

type SidebarNavProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  vaultView: DashboardView;
  onVaultViewChange: (view: DashboardView) => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  isMobileNavOpen: boolean;
  onMobileNavClose: () => void;
};

export const SidebarNav = ({
  activeTab,
  onTabChange,
  vaultView,
  onVaultViewChange,
  onOpenHelp,
  onOpenSettings,
  isMobileNavOpen,
  onMobileNavClose,
}: SidebarNavProps) => {
  const { actions, preview, settings, vault } = useAppState();
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>(() =>
    activeTab === "dashboard" ? "vault" : "cards",
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [isVaultMenuOpen, setIsVaultMenuOpen] = useState(false);
  const [vaultMenuMaxHeight, setVaultMenuMaxHeight] = useState<number | null>(null);
  const vaultStatusRef = useRef<HTMLDivElement | null>(null);
  const vaultMenuRef = useRef<HTMLDivElement | null>(null);
  const vaultButtonRef = useRef<HTMLButtonElement | null>(null);
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
    activeTab === "flashcard" ||
    activeTab === "fast-flashcard" ||
    activeTab === "spaced-repetition";
  const isDashboard = activeTab === "dashboard";
  const isMarkdownView = isDashboard && vaultView === "markdown";
  const isExamView = isDashboard && vaultView === "exam";
  const toggleLabel = isToolbarCollapsed ? "Expand toolbar" : "Collapse toolbar";
  const toggleSymbol = isToolbarCollapsed ? ">" : "<";
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

  const handleToolbarToggle = useCallback(() => {
    settings.setRightToolbarCollapsed((prev) => !prev);
  }, [settings]);

  useEffect(() => {
    if (isDashboard && toolbarMode !== "vault") {
      setToolbarMode("vault");
      return;
    }
    if (isCardsTab && toolbarMode !== "cards") {
      setToolbarMode("cards");
    }
  }, [isCardsTab, isDashboard, toolbarMode]);

  const updateVaultMenuMaxHeight = useCallback(() => {
    const statusElement = vaultStatusRef.current;
    if (!statusElement) {
      return;
    }
    const sidebar = statusElement.closest(".sidebar") as HTMLElement | null;
    if (!sidebar) {
      return;
    }
    const sidebarRect = sidebar.getBoundingClientRect();
    const statusRect = statusElement.getBoundingClientRect();
    const gap = 8;
    const safeOffset = 4;
    const available = statusRect.top - sidebarRect.top - gap - safeOffset;
    setVaultMenuMaxHeight(Math.max(0, Math.floor(available)));
  }, []);

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
      setVaultMenuMaxHeight(null);
      return;
    }
    updateVaultMenuMaxHeight();
    window.addEventListener("resize", updateVaultMenuMaxHeight);
    return () => {
      window.removeEventListener("resize", updateVaultMenuMaxHeight);
    };
  }, [isVaultMenuOpen, updateVaultMenuMaxHeight]);

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
      {isCollapsed ? (
        <button
          type="button"
          className="sidebar-collapsed-trigger"
          onClick={handleToolbarToggle}
          aria-label="Expand toolbar"
          title="Expand toolbar"
        >
          <span className="sidebar-collapsed-icon" aria-hidden="true">
            {">"}
          </span>
        </button>
      ) : null}
      <button
        type="button"
        className="sidebar-handle"
        onClick={handleToolbarToggle}
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
            <div className="vault-status" ref={vaultStatusRef}>
              <div className="vault-status-header">
                <span className="label">ACTIVE VAULT</span>
                <div className="vault-status-actions">
                  <button
                    type="button"
                    className="vault-status-action"
                    onClick={() => {
                      setIsVaultMenuOpen(false);
                      onOpenHelp();
                    }}
                    aria-label="Help"
                    title="Help"
                  >
                    <HelpIcon />
                  </button>
                  <button
                    type="button"
                    className="vault-status-action"
                    onClick={() => {
                      setIsVaultMenuOpen(false);
                      onOpenSettings();
                    }}
                    aria-label="Settings"
                    title="Settings"
                  >
                    <SettingsIcon />
                  </button>
                </div>
              </div>
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
              <div className="vault-status-secondary">
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
              </div>
              {isVaultMenuOpen ? (
                <div
                  ref={vaultMenuRef}
                  id="vault-recents-menu"
                  className="vault-status-menu"
                  role="menu"
                  aria-label="Recent vaults"
                  style={
                    vaultMenuMaxHeight !== null
                      ? ({ "--vault-menu-max-height": `${vaultMenuMaxHeight}px` } as CSSProperties)
                      : undefined
                  }
                >
                  <div className="vault-status-menu-scroll" role="presentation">
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
                                  onClick={() =>
                                    actions.handleRemoveRecentVault(entry.path)
                                  }
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="vault-status-menu-footer" role="presentation">
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
                    </div>
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
                  isMarkdownView ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("vault");
                  onVaultViewChange("markdown");
                  if (!isDashboard) {
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
                  isExamView ? "active" : ""
                }`}
                onClick={() => {
                  setToolbarMode("vault");
                  onVaultViewChange("exam");
                  if (!isDashboard) {
                    onTabChange("dashboard");
                  }
                }}
                aria-label="Exam editor"
                title="Exam editor"
              >
                <ExamEditorIcon />
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
                folders={vault.folders}
                showHiddenFolders={settings.showHiddenFolders}
                showEmptyFolders={settings.showEmptyFolders}
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
        </>
      )}
    </aside>
  );
};
