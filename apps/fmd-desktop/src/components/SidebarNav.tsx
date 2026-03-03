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
  GridEventIcon,
  HelpIcon,
  SettingsIcon,
} from "./icons";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import { useVaultPathInfo } from "../features/vault/useVaultPathInfo";
import type { DashboardView } from "../pages/DashboardPage";
import { CARD_SECTION_KEYS, CARD_SECTIONS, type StudySectionKey } from "../lib/studySections";

type ToolbarMode = "cards" | "vault";

type SidebarNavProps = {
  activeTab: StudySectionKey;
  onTabChange: (tab: StudySectionKey) => void;
  vaultView: DashboardView;
  onVaultViewChange: (view: DashboardView) => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onMobileNavClose: () => void;
};

export const SidebarNav = ({
  activeTab,
  onTabChange,
  vaultView,
  onVaultViewChange,
  onOpenHelp,
  onOpenSettings,
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
  const vaultLayoutRef = useRef<HTMLDivElement | null>(null);
  const vaultStatusRef = useRef<HTMLDivElement | null>(null);
  const vaultMenuRef = useRef<HTMLDivElement | null>(null);
  const vaultButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const isCardsTab = CARD_SECTION_KEYS.includes(activeTab);
  const isDashboard = activeTab === "dashboard";
  const isMarkdownView = isDashboard && vaultView === "markdown";
  const isExamView = isDashboard && vaultView === "exam";
  const handleOpenEditor = useCallback(() => {
    setToolbarMode("vault");
    onVaultViewChange("markdown");
    if (!isDashboard) {
      onTabChange("dashboard");
    }
  }, [isDashboard, onTabChange, onVaultViewChange]);
  const handleOpenExamEditor = useCallback(() => {
    setToolbarMode("vault");
    onVaultViewChange("exam");
    if (!isDashboard) {
      onTabChange("dashboard");
    }
  }, [isDashboard, onTabChange, onVaultViewChange]);
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
    const layoutElement = vaultLayoutRef.current;
    const statusElement = vaultStatusRef.current;
    if (!layoutElement || !statusElement) {
      return;
    }
    const layoutRect = layoutElement.getBoundingClientRect();
    const statusRect = statusElement.getBoundingClientRect();
    const gap = 8;
    const safeOffset = 4;
    const available = statusRect.top - layoutRect.top - gap - safeOffset;
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
      className="sidebar"
      aria-label="Primary navigation"
    >
      <div className="sidebar-head">
        <button
          type="button"
          className="mobile-nav-close"
          onClick={onMobileNavClose}
          aria-label="Close navigation"
        >
          Close
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
            onClick={handleOpenEditor}
            aria-label="Editor"
            aria-controls="sidebar-vault-panel"
            aria-expanded={toolbarMode === "vault"}
            title="Editor"
          >
            <GridEventIcon />
          </button>
          <button
            type="button"
            className={`nav-icon sidebar-icon-button ${
              isExamView ? "active" : ""
            }`}
            onClick={handleOpenExamEditor}
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
      <div className="sidebar-main" ref={vaultLayoutRef}>
        <div className="sidebar-main-content">
          {toolbarMode === "cards" ? (
            <nav className="nav">
              {CARD_SECTIONS.map((section) => {
                const isActive = activeTab === section.key;
                return (
                  <button
                    key={section.key}
                    type="button"
                    className={`nav-item ${isActive ? "active" : ""}`}
                    onClick={() => onTabChange(section.key)}
                  >
                    {section.label}
                  </button>
                );
              })}
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
                refreshLabel={refreshLabel}
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
        </div>
      </div>
    </aside>
  );
};
