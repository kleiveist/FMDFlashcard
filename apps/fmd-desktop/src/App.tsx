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
import { StudySectionNav } from "./components/StudySectionNav";
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
import type { StudySectionKey } from "./lib/studySections";

const NARROW_WIDTH_BREAKPOINT = 900;
const NARROW_ASPECT_RATIO = 0.8;

const AppContent = () => {
  const { actions, flashcards, fastFlashcards, help, settings, spacedRepetition } =
    useAppState();
  const [activeTab, setActiveTab] = useState<StudySectionKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>("markdown");
  const dashboardRef = useRef<DashboardPageHandle | null>(null);
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const [showStudySectionNav, setShowStudySectionNav] = useState(false);
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
    (tab: StudySectionKey) => {
      setActiveTab(tab);
      setIsMobileNavOpen(false);
    },
    [setActiveTab, setIsMobileNavOpen],
  );
  const handleStudySectionSelect = useCallback(
    (tab: StudySectionKey) => {
      handleTabChange(tab);
      if (tab === "flashcard" && !flashcards.isFlashcardScanning) {
        void flashcards.handleFlashcardScan();
      } else if (tab === "fast-flashcard" && !fastFlashcards.isFlashcardScanning) {
        void fastFlashcards.handleFlashcardScan();
      } else if (
        tab === "spaced-repetition" &&
        !flashcards.isFlashcardScanning &&
        spacedRepetition.spacedRepetitionActiveUser
      ) {
        void spacedRepetition.handleSpacedRepetitionActiveUserLoadCards();
      }
    },
    [flashcards, fastFlashcards, handleTabChange, spacedRepetition],
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

  useEffect(() => {
    const shell = appShellRef.current;
    if (!shell) {
      return;
    }

    const evaluateLayout = (width: number, height: number) => {
      const isNarrowWidth = width <= NARROW_WIDTH_BREAKPOINT;
      const aspectRatio = height > 0 ? width / height : 1;
      const isNarrowAspect = aspectRatio <= NARROW_ASPECT_RATIO;
      const shouldShow = isNarrowWidth || isNarrowAspect;
      setShowStudySectionNav((prev) => (prev === shouldShow ? prev : shouldShow));
    };

    const updateFromRect = () => {
      const rect = shell.getBoundingClientRect();
      evaluateLayout(rect.width, rect.height);
    };

    if (typeof ResizeObserver === "undefined") {
      updateFromRect();
      window.addEventListener("resize", updateFromRect);
      return () => window.removeEventListener("resize", updateFromRect);
    }

    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => evaluateLayout(width, height));
    });

    observer.observe(shell);
    updateFromRect();

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
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
      ref={appShellRef}
      className={`app-shell ${showStudySectionNav ? "compact-top-nav" : ""} ${
        settings.rightToolbarCollapsed ? "sidebar-collapsed" : ""
      } ${isDashboard ? "dashboard-active" : ""} ${
        isMobileNavOpen ? "nav-open" : ""
      }`}
    >
      {showStudySectionNav ? (
        <StudySectionNav
          activeTab={activeTab}
          onSectionSelect={handleStudySectionSelect}
        />
      ) : null}
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
          <div id="mobile-nav-actions" className="mobile-nav-actions" />
        </div>
        {activeTab === "dashboard" ? (
          <DashboardPage
            ref={dashboardRef}
            initialVaultView={dashboardView}
            onVaultViewChange={setDashboardView}
          />
        ) : activeTab === "exam" ? (
          <ExamSimulationPage isTableView={showStudySectionNav} />
        ) : activeTab === "flashcard" ? (
          <FlashcardPage onSectionSelect={handleStudySectionSelect} />
        ) : activeTab === "spaced-repetition" ? (
          <SpacedRepetitionPage onSectionSelect={handleStudySectionSelect} />
        ) : (
          <FastFlashcardPage onSectionSelect={handleStudySectionSelect} />
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
