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

import { useState } from "react";
import "./App.css";
import { AppStateProvider, useAppState } from "./components/AppStateProvider";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SidebarNav } from "./components/SidebarNav";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamSimulationPage } from "./pages/ExamSimulationPage";
import { FlashcardPage } from "./pages/FlashcardPage";
import { FastFlashcardPage } from "./pages/FastFlashcardPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";

type TabKey =
  | "dashboard"
  | "exam"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard"
  | "help"
  | "settings";

const AppContent = () => {
  const { settings } = useAppState();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isDashboard = activeTab === "dashboard";
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
  };

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
          <DashboardPage />
        ) : activeTab === "exam" ? (
          <ExamSimulationPage />
        ) : activeTab === "flashcard" ? (
          <FlashcardPage />
        ) : activeTab === "spaced-repetition" ? (
          <SpacedRepetitionPage />
        ) : activeTab === "fast-flashcard" ? (
          <FastFlashcardPage />
        ) : activeTab === "help" ? (
          <HelpPage />
        ) : (
          <SettingsPage />
        )}
      </main>
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
