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
  type KeyboardEvent as ReactKeyboardEvent,
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
import type { PreviewFileOpenOptions } from "../features/preview/usePreview";
import type { DashboardView } from "../pages/DashboardPage";
import {
  MONITORING_MODE_SECTIONS,
  STUDY_MODE_SECTIONS,
  isMonitoringModeSection,
  isStudyModeSection,
  type StudyMainMode,
  type StudySectionKey,
} from "../lib/studySections";
import type { VaultFile } from "../lib/tree";

type ToolbarMode = StudyMainMode | "vault";

type SidebarNavProps = {
  activeTab: StudySectionKey;
  activeMainMode: StudyMainMode;
  onMainModeSelect: (mode: StudyMainMode) => void;
  onTabChange: (tab: StudySectionKey) => void;
  onSelectVaultFile?: (file: VaultFile, options?: PreviewFileOpenOptions) => void;
  vaultView: DashboardView;
  onVaultViewChange: (view: DashboardView) => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onOpenUserManager: () => void;
  onMobileNavClose: () => void;
};

const buildUserInitials = (value: string) => {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "NA";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

export const SidebarNav = ({
  activeTab,
  activeMainMode,
  onMainModeSelect,
  onTabChange,
  onSelectVaultFile,
  vaultView,
  onVaultViewChange,
  onOpenHelp,
  onOpenSettings,
  onOpenUserManager,
  onMobileNavClose,
}: SidebarNavProps) => {
  const { actions, preview, settings, spacedRepetition, vault } = useAppState();
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>(() =>
    activeTab === "dashboard" ? "vault" : activeMainMode,
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [isVaultMenuOpen, setIsVaultMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [vaultMenuMaxHeight, setVaultMenuMaxHeight] = useState<number | null>(null);
  const vaultLayoutRef = useRef<HTMLDivElement | null>(null);
  const vaultStatusRef = useRef<HTMLDivElement | null>(null);
  const vaultMenuRef = useRef<HTMLDivElement | null>(null);
  const vaultButtonRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userButtonRef = useRef<HTMLButtonElement | null>(null);
  const vaultRootName = useMemo(
    () => vaultBaseName(vault.vaultPath),
    [vault.vaultPath],
  );
  const activeUserName = spacedRepetition.spacedRepetitionActiveUser?.trim() ?? "";
  const activeUserId = spacedRepetition.spacedRepetitionActiveUserId;
  const activeUserLabel = activeUserName || "No active user";
  const activeUserInitials = useMemo(
    () => buildUserInitials(activeUserLabel),
    [activeUserLabel],
  );
  const userProfiles = spacedRepetition.spacedRepetitionUsers;
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
  const isStudyTab = isStudyModeSection(activeTab);
  const isMonitoringTab = isMonitoringModeSection(activeTab);
  const isDashboard = activeTab === "dashboard";
  const isMarkdownView = isDashboard && vaultView === "markdown";
  const isExamView = isDashboard && vaultView === "exam";
  const handleVaultFileSelect = useCallback(
    (file: VaultFile, options?: PreviewFileOpenOptions) => {
      if (onSelectVaultFile) {
        onSelectVaultFile(file, options);
        return;
      }
      actions.handleSelectFile(file, options);
    },
    [actions, onSelectVaultFile],
  );
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
    if (isStudyTab && toolbarMode !== "study") {
      setToolbarMode("study");
      return;
    }
    if (isMonitoringTab && toolbarMode !== "monitoring") {
      setToolbarMode("monitoring");
    }
  }, [isDashboard, isMonitoringTab, isStudyTab, toolbarMode]);

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
    if (!isUserMenuOpen) {
      return;
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (userMenuRef.current?.contains(target)) {
        return;
      }
      if (userButtonRef.current?.contains(target)) {
        return;
      }
      setIsUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isUserMenuOpen]);

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

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }
    return registerCloseLayer({
      id: "active-user-menu",
      priority: 210,
      isActive: () => isUserMenuOpen,
      onClose: () => {
        setIsUserMenuOpen(false);
        userButtonRef.current?.focus();
      },
    });
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }
    const firstButton = userMenuRef.current?.querySelector<HTMLButtonElement>(
      '[data-user-menu-item="true"]:not(:disabled)',
    );
    firstButton?.focus();
  }, [isUserMenuOpen]);

  const handleUserMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!isUserMenuOpen) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsUserMenuOpen(false);
        userButtonRef.current?.focus();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        return;
      }
      const items = Array.from(
        userMenuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[data-user-menu-item="true"]:not(:disabled)',
        ) ?? [],
      );
      if (items.length === 0) {
        return;
      }
      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = items.findIndex((item) => item === activeElement);
      let nextIndex = 0;
      if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = items.length - 1;
      } else if (event.key === "ArrowDown") {
        nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
      } else {
        nextIndex =
          currentIndex >= 0
            ? (currentIndex - 1 + items.length) % items.length
            : items.length - 1;
      }
      event.preventDefault();
      items[nextIndex]?.focus();
    },
    [isUserMenuOpen],
  );

  const handleUserMenuToggle = useCallback(() => {
    setIsUserMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsVaultMenuOpen(false);
      }
      return next;
    });
  }, []);

  const handleSetActiveUser = useCallback(
    (userId: string) => {
      setIsUserMenuOpen(false);
      if (userId === activeUserId) {
        return;
      }
      spacedRepetition.setActiveUser(userId);
    },
    [activeUserId, spacedRepetition],
  );

  const activeModeSections = toolbarMode === "study"
    ? STUDY_MODE_SECTIONS
    : toolbarMode === "monitoring"
      ? MONITORING_MODE_SECTIONS
      : null;

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
        <div className="sidebar-active-user">
          <span className="label">ACTIVE USER</span>
          <button
            ref={userButtonRef}
            type="button"
            className="sidebar-active-user-trigger"
            onClick={handleUserMenuToggle}
            aria-label="Select active user"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            aria-controls="sidebar-active-user-menu"
          >
            <span className="sidebar-active-user-main">
              <span className="sidebar-active-user-avatar" aria-hidden="true">
                {activeUserInitials}
              </span>
              <span className="value sidebar-active-user-name">{activeUserLabel}</span>
            </span>
            <span
              className={`sidebar-active-user-caret${isUserMenuOpen ? " is-open" : ""}`}
              aria-hidden="true"
            >
              <ChevronDownIcon />
            </span>
          </button>
          {isUserMenuOpen ? (
            <div
              ref={userMenuRef}
              id="sidebar-active-user-menu"
              className="sidebar-active-user-menu"
              role="menu"
              aria-label="User profiles"
              onKeyDown={handleUserMenuKeyDown}
            >
              <div className="sidebar-active-user-menu-scroll" role="presentation">
                {userProfiles.length === 0 ? (
                  <div className="sidebar-active-user-menu-empty muted">
                    No users created yet.
                  </div>
                ) : (
                  userProfiles.map((user) => {
                    const isActive = user.id === activeUserId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={`sidebar-active-user-menu-item${isActive ? " is-active" : ""}`}
                        role="menuitemradio"
                        aria-checked={isActive}
                        data-user-menu-item="true"
                        onClick={() => handleSetActiveUser(user.id)}
                        title={user.name}
                      >
                        <span className="sidebar-active-user-menu-name">{user.name}</span>
                        {isActive ? (
                          <span className="sidebar-active-user-menu-check" aria-hidden="true">
                            <CheckIcon />
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="sidebar-active-user-menu-footer" role="presentation">
                <div className="sidebar-active-user-menu-divider" role="separator" />
                <button
                  type="button"
                  className="sidebar-active-user-menu-item sidebar-active-user-menu-manage"
                  role="menuitem"
                  data-user-menu-item="true"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenUserManager();
                  }}
                >
                  Manage User
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="sidebar-icon-row">
          <button
            type="button"
            className={`nav-icon sidebar-icon-button ${
              toolbarMode === "study" ? "active" : ""
            }`}
            onClick={() => {
              setToolbarMode("study");
              onMainModeSelect("study");
            }}
            aria-label="Study flashcards"
            title="Study"
          >
            <CardsIcon />
          </button>
          <button
            type="button"
            className={`nav-icon sidebar-icon-button ${
              toolbarMode === "monitoring" ? "active" : ""
            }`}
            onClick={() => {
              setToolbarMode("monitoring");
              onMainModeSelect("monitoring");
            }}
            aria-label="Monitoring tools"
            title="Monitoring"
          >
            <CheckIcon />
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
          {activeModeSections ? (
            <nav className="nav">
              {activeModeSections.map((section) => {
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
                onSelectFile={handleVaultFileSelect}
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
                  setIsUserMenuOpen(false);
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
                  setIsUserMenuOpen(false);
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
            onClick={() => {
              setIsUserMenuOpen(false);
              setIsVaultMenuOpen((prev) => !prev);
            }}
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
