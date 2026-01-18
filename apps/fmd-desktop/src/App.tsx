/**
 * @file apps/fmd-desktop/src/App.tsx
 *
 * Zweck:
 * - Rendert die App-Shell und routet zwischen Hauptseiten.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/AppErrorBoundary.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/components/SidebarNav.tsx: UI-Komponente.
 *
 * Exportiert:
 * - App: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { AppStateProvider, useAppState } from "./components/AppStateProvider";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ModalShell } from "./components/ModalShell";
import { SidebarNav } from "./components/SidebarNav";
import {
  getEffectiveBinding,
  getShortcutPlatform,
  isEditableTarget,
  matchesBinding,
} from "./lib/shortcuts/bindings";
import { getActiveCloseLayer } from "./lib/shortcuts/closeOrBack";
import { getShortcutById } from "./lib/shortcuts/registry";
import { logWordPressFeatureStatus } from "./lib/featureFlags";
import { registerGlobalShortcuts } from "./keybindings/registerGlobalShortcuts";
import { DashboardPage, type DashboardPageHandle, type DashboardView } from "./pages/DashboardPage";
import { ExamSimulationPage } from "./pages/ExamSimulationPage";
import { FlashcardPage } from "./pages/FlashcardPage";
import { FastFlashcardPage } from "./pages/FastFlashcardPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";
import { DEFAULT_HELP_TOPIC_ID } from "./pages/help/helpContent";

type TabKey =
  | "dashboard"
  | "exam"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard";

const AppContent = () => {
  const { actions, help, settings } = useAppState();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>("markdown");
  const dashboardRef = useRef<DashboardPageHandle | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isDashboard = activeTab === "dashboard";
  const platform = getShortcutPlatform();
  const closeCommand = useMemo(() => getShortcutById("uiCloseOrBack"), []);
  const closeBinding = useMemo(
    () =>
      closeCommand
        ? getEffectiveBinding(closeCommand, settings.keyboardShortcuts.bindings, platform)
        : null,
    [closeCommand, platform, settings.keyboardShortcuts.bindings],
  );
  const handleTabChange = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      setIsMobileNavOpen(false);
    },
    [setActiveTab, setIsMobileNavOpen],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!closeCommand || !closeBinding) {
        return;
      }
      if (!closeCommand.allowInTextInputs && isEditableTarget(event.target)) {
        return;
      }
      if (!matchesBinding(event, closeBinding)) {
        return;
      }
      const layer = getActiveCloseLayer();
      if (!layer) {
        return;
      }
      event.preventDefault();
      layer.onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeBinding, closeCommand]);

  useEffect(() => {
    logWordPressFeatureStatus();
  }, []);

  const requestDashboardViewChange = useCallback(
    (nextView: DashboardView) => {
      if (activeTab === "dashboard" && dashboardRef.current) {
        dashboardRef.current.requestVaultViewChange(nextView);
        return;
      }
      setDashboardView(nextView);
    },
    [activeTab],
  );

  const handleOpenHelp = useCallback(() => {
    help.setActiveTopicId(DEFAULT_HELP_TOPIC_ID);
    setIsHelpOpen(true);
    setIsSettingsOpen(false);
  }, [help]);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
    setIsHelpOpen(false);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  useEffect(() => {
    const dispose = registerGlobalShortcuts({
      bindings: settings.keyboardShortcuts.bindings,
      platform,
      context: {
        actions: {
          handleRescanVault: actions.handleRescanVault,
        },
      },
    });
    return dispose;
  }, [
    actions.handleRescanVault,
    platform,
    settings.keyboardShortcuts.bindings,
  ]);

  return (
    <div
      className={`app-shell ${
        settings.rightToolbarCollapsed ? "sidebar-collapsed" : ""
      } ${isDashboard ? "dashboard-active" : ""} ${
        isMobileNavOpen ? "nav-open" : ""
      }`}
    >
      <SidebarNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        vaultView={dashboardView}
        onVaultViewChange={requestDashboardViewChange}
        onOpenHelp={handleOpenHelp}
        onOpenSettings={handleOpenSettings}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
      />
      <main className="content">
        <div className="mobile-nav-header">
          <button
            type="button"
            className="ghost small mobile-nav-toggle"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={isMobileNavOpen}
          >
            Menu
          </button>
        </div>
        {activeTab === "dashboard" ? (
          <DashboardPage
            ref={dashboardRef}
            initialVaultView={dashboardView}
            onVaultViewChange={setDashboardView}
          />
        ) : activeTab === "exam" ? (
          <ExamSimulationPage />
        ) : activeTab === "flashcard" ? (
          <FlashcardPage />
        ) : activeTab === "spaced-repetition" ? (
          <SpacedRepetitionPage />
        ) : (
          <FastFlashcardPage />
        )}
      </main>
      <ModalShell isOpen={isHelpOpen} title="Help" onClose={handleCloseHelp}>
        <div className="hub-modal-scroll">
          <HelpPage onCloseHelp={handleCloseHelp} />
        </div>
      </ModalShell>
      <ModalShell isOpen={isSettingsOpen} title="Settings" onClose={handleCloseSettings}>
        <div className="hub-modal-scroll">
          <SettingsPage />
        </div>
      </ModalShell>
      <button
        type="button"
        className="mobile-nav-backdrop"
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden={!isMobileNavOpen}
        tabIndex={-1}
      />
    </div>
  );
};

function App() {
  return (
    <AppErrorBoundary>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </AppErrorBoundary>
  );
}

export default App;
