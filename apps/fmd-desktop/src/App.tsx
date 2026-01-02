import { useState } from "react";
import "./App.css";
import { AppStateProvider } from "./components/AppStateProvider";
import { SidebarNav } from "./components/SidebarNav";
import { DashboardPage } from "./pages/DashboardPage";
import { FlashcardPage } from "./pages/FlashcardPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "help"
  | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  return (
    <AppStateProvider>
      <div className="app-shell">
        <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="content">
          {activeTab === "dashboard" ? (
            <DashboardPage />
          ) : activeTab === "flashcard" ? (
            <FlashcardPage />
          ) : activeTab === "spaced-repetition" ? (
            <SpacedRepetitionPage />
          ) : activeTab === "help" ? (
            <HelpPage />
          ) : (
            <SettingsPage />
          )}
        </main>
      </div>
    </AppStateProvider>
  );
}

export default App;
