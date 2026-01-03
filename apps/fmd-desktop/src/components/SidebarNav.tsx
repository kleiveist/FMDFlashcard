import { useMemo } from "react";
import { useAppState } from "./AppStateProvider";
import { vaultBaseName } from "../lib/path";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "help"
  | "settings";

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
  const { actions, settings, vault } = useAppState();
  const vaultRootName = useMemo(
    () => vaultBaseName(vault.vaultPath),
    [vault.vaultPath],
  );
  const isCollapsed = settings.rightToolbarCollapsed && !isMobileNavOpen;

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
                activeTab === "spaced-repetition" ? "active" : ""
              }`}
              onClick={() => onTabChange("spaced-repetition")}
            >
              Spaced Repetition
            </button>
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
          </nav>
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
        </>
      )}
    </aside>
  );
};
