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
import { NoteModal } from "./components/NoteModal";
import { NoteFilesPanel } from "./components/NoteFilesPanel";
import { SidebarNav } from "./components/SidebarNav";
import { StudySectionNav } from "./components/StudySectionNav";
import {
  UserVaultCustomPathModal,
  UserVaultProfileModal,
  UserVaultSyncProviderModal,
} from "./components/UserVaultGateModals";
import { LayoutModeProvider, useLayoutMode } from "./lib/layoutMode";
import { useMediaQuery } from "./lib/useMediaQuery";
import {
  getEffectiveBinding,
  getShortcutPlatform,
  isEditableTarget,
  matchesBinding,
} from "./lib/shortcuts/bindings";
import { getActiveCloseLayer } from "./lib/shortcuts/closeOrBack";
import { getShortcutById } from "./lib/shortcuts/registry";
import { isSyncProviderEnabled, logWordPressFeatureStatus } from "./lib/featureFlags";
import { registerGlobalShortcuts } from "./keybindings/registerGlobalShortcuts";
import { subscribeSettingsFocus } from "./features/settings/settingsDeepLink";
import { DashboardPage, type DashboardPageHandle, type DashboardView } from "./pages/DashboardPage";
import { ExamSimulationPage } from "./pages/ExamSimulationPage";
import { FlashcardPage } from "./pages/FlashcardPage";
import { FastFlashcardPage } from "./pages/FastFlashcardPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";
import { DEFAULT_HELP_TOPIC_ID } from "./pages/help/helpContent";
import { ExamFilePanel } from "./pages/exam-simulation/components/ExamFilePanel";
import type { StudySectionKey } from "./lib/studySections";

type WalletGateId = "custom-path" | "profile" | "sync-provider";

const AppContent = () => {
  const {
    actions,
    flashcardNoteFiles,
    flashcardNoteFilesError,
    flashcardNoteFilesState,
    examFiles,
    examFilesError,
    examFilesState,
    flashcards,
    fastFlashcards,
    help,
    preview,
    settings,
    settingsNav,
    spacedRepetition,
    userVault,
    vault,
  } = useAppState();
  const [activeTab, setActiveTab] = useState<StudySectionKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>("markdown");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteDialogSection, setNoteDialogSection] = useState<StudySectionKey | null>(
    null,
  );
  const dashboardRef = useRef<DashboardPageHandle | null>(null);
  const noteButtonRef = useRef<HTMLButtonElement | null>(null);
  const noteWasOpenRef = useRef(false);
  const prevTabRef = useRef<StudySectionKey>(activeTab);
  const prevDashboardViewRef = useRef<DashboardView>(dashboardView);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openGateId, setOpenGateId] = useState<WalletGateId | null>(null);
  const [dismissedGateId, setDismissedGateId] = useState<WalletGateId | null>(null);
  const isDashboard = activeTab === "dashboard";
  const platform = getShortcutPlatform();
  const layoutMode = useLayoutMode();
  const showStudySectionNav = layoutMode === "table";
  const isToolbarCollapsed = layoutMode === "table";
  const isNoteViewport = useMediaQuery("(max-width: 980px)", false);
  const isDashboardNoteEligible =
    activeTab === "dashboard" &&
    (dashboardView === "markdown" || dashboardView === "exam") &&
    isNoteViewport;
  const isSectionNoteEligible = isNoteViewport && activeTab !== "dashboard";
  const isNoteModalEligible = isDashboardNoteEligible || isSectionNoteEligible;
  const closeCommand = useMemo(() => getShortcutById("uiCloseOrBack"), []);
  const closeBinding = useMemo(
    () =>
      closeCommand
        ? getEffectiveBinding(closeCommand, settings.keyboardShortcuts.bindings, platform)
        : null,
    [closeCommand, platform, settings.keyboardShortcuts.bindings],
  );
  const activeProfileName = userVault.activeProfile?.name?.trim() ?? "";
  const isWalletOpen = Boolean(vault.vaultPath);
  const isUserVaultReady = userVault.status !== "loading";
  const isActivePathReady = Boolean(userVault.resolvedPath);
  const isProfileReady = Boolean(userVault.activeProfileId && activeProfileName);
  const syncProviderEnabled = isSyncProviderEnabled();
  const syncProviderRequired = false; // TODO: enable when product rule requires sync setup.
  const syncProviderConfigured = false; // TODO: wire to persisted sync provider config.
  const shouldGateSyncProvider =
    syncProviderEnabled && syncProviderRequired && !syncProviderConfigured;
  const nextGate: WalletGateId | null = !isWalletOpen || !isUserVaultReady
    ? null
    : !isActivePathReady
      ? "custom-path"
      : !isProfileReady
        ? "profile"
        : shouldGateSyncProvider
          ? "sync-provider"
          : null;
  const showInlineGate = Boolean(nextGate) && !openGateId;
  const gateCopy = nextGate
    ? {
        "custom-path": {
          eyebrow: "Active path required",
          title: "Set an active path to continue",
          description:
            "Choose where your profile data is stored. Pick a custom folder if you prefer.",
          cta: "Set active path",
        },
        profile: {
          eyebrow: "Profile required",
          title: "Create a profile to continue",
          description:
            "Your progress is stored per profile. Create or load a profile to continue working in this vault.",
          cta: "Create profile",
        },
        "sync-provider": {
          eyebrow: "Sync provider",
          title: "Configure sync provider",
          description: "Set up a sync provider to continue.",
          cta: "Configure sync",
        },
      }[nextGate]
    : null;
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
  const handleTabChange = useCallback(
    (tab: StudySectionKey) => {
      setActiveTab(tab);
      setIsMobileNavOpen(false);
    },
    [setActiveTab, setIsMobileNavOpen],
  );
  const handleStudySectionSelect = useCallback(
    (tab: StudySectionKey) => {
      if (tab === "dashboard") {
        const nextView: DashboardView =
          dashboardView === "markdown" ? "exam" : "markdown";
        requestDashboardViewChange(nextView);
        handleTabChange("dashboard");
        return;
      }
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
    [
      dashboardView,
      flashcards,
      fastFlashcards,
      handleTabChange,
      requestDashboardViewChange,
      spacedRepetition,
    ],
  );

  const handleGateClose = useCallback(() => {
    setDismissedGateId((prev) => openGateId ?? prev);
    setOpenGateId(null);
  }, [openGateId]);

  const handleGateOpen = useCallback(() => {
    if (!nextGate) {
      return;
    }
    setDismissedGateId(null);
    setOpenGateId(nextGate);
  }, [nextGate]);

  const handleNoteModalOpen = useCallback(() => {
    if (!isNoteModalEligible) {
      return;
    }
    setNoteDialogSection(activeTab);
    setIsNoteModalOpen(true);
  }, [activeTab, isNoteModalEligible]);

  const handleNoteModalClose = useCallback(() => {
    setIsNoteModalOpen(false);
    setNoteDialogSection(null);
  }, []);

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
    if (!isNoteModalOpen) {
      return;
    }
    if (!isNoteModalEligible) {
      setIsNoteModalOpen(false);
      setNoteDialogSection(null);
    }
  }, [isNoteModalEligible, isNoteModalOpen]);

  useEffect(() => {
    if (!isNoteModalOpen) {
      prevTabRef.current = activeTab;
      prevDashboardViewRef.current = dashboardView;
      return;
    }
    const tabChanged = prevTabRef.current !== activeTab;
    const viewChanged = prevDashboardViewRef.current !== dashboardView;
    if (tabChanged || viewChanged) {
      setIsNoteModalOpen(false);
      setNoteDialogSection(null);
    }
    prevTabRef.current = activeTab;
    prevDashboardViewRef.current = dashboardView;
  }, [activeTab, dashboardView, isNoteModalOpen]);

  useEffect(() => {
    if (noteWasOpenRef.current && !isNoteModalOpen) {
      noteButtonRef.current?.focus();
    }
    noteWasOpenRef.current = isNoteModalOpen;
  }, [isNoteModalOpen]);

  const noteFilesDialogOpen = Boolean(
    isNoteModalOpen && noteDialogSection && noteDialogSection !== "dashboard",
  );
  const isExamNoteFiles = noteDialogSection === "exam";
  const noteModalTitle = isExamNoteFiles ? "Exam Files" : "Note";
  const selectedExamFile =
    examFiles.find((file) => file.path === preview.selectedFile?.path) ?? null;

  useEffect(() => {
    if (!nextGate) {
      setOpenGateId(null);
      setDismissedGateId(null);
      return;
    }
    if (dismissedGateId === nextGate) {
      setOpenGateId(null);
      return;
    }
    setOpenGateId(nextGate);
  }, [dismissedGateId, nextGate]);

  useEffect(() => {
    logWordPressFeatureStatus();
  }, []);

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
    return subscribeSettingsFocus((request) => {
      settingsNav.setActiveSettingsPage(request.pageId);
      setIsSettingsOpen(true);
      setIsHelpOpen(false);
    });
  }, [settingsNav, setIsHelpOpen, setIsSettingsOpen]);

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
      className={`app-shell layout-${layoutMode} ${
        showStudySectionNav ? "compact-top-nav" : ""
      } ${isToolbarCollapsed ? "sidebar-collapsed" : ""} ${
        isDashboard ? "dashboard-active" : ""
      } ${
        isMobileNavOpen ? "nav-open" : ""
      }`}
      data-study-subview={dashboardView}
    >
      {showStudySectionNav ? (
        <StudySectionNav
          activeTab={activeTab}
          onSectionSelect={handleStudySectionSelect}
          isMobileNavOpen={isMobileNavOpen}
          onMobileNavOpen={() => setIsMobileNavOpen(true)}
          showNoteAction={isNoteModalEligible}
          onNoteAction={handleNoteModalOpen}
          noteActionRef={noteButtonRef}
          isNoteActionActive={isNoteModalOpen}
        />
      ) : null}
      <SidebarNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        vaultView={dashboardView}
        onVaultViewChange={requestDashboardViewChange}
        onOpenHelp={handleOpenHelp}
        onOpenSettings={handleOpenSettings}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
      />
      <main className="content">
        <div className="mobile-nav-header">
          {!showStudySectionNav ? (
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
          ) : null}
          <div id="mobile-nav-actions" className="mobile-nav-actions" />
        </div>
        {activeTab !== "dashboard" && showInlineGate && gateCopy ? (
          <section className="panel">
            <div className="panel-header">
              <div className="panel-header-content">
                <span className="eyebrow">{gateCopy.eyebrow}</span>
                <h3>{gateCopy.title}</h3>
                <p className="muted">{gateCopy.description}</p>
              </div>
              <button type="button" className="primary" onClick={handleGateOpen}>
                {gateCopy.cta}
              </button>
            </div>
          </section>
        ) : null}
        {activeTab === "dashboard" ? (
          <DashboardPage
            ref={dashboardRef}
            initialVaultView={dashboardView}
            onVaultViewChange={setDashboardView}
            isNoteModalOpen={isNoteModalOpen}
            noteModalEnabled={isNoteModalEligible}
            onNoteModalClose={handleNoteModalClose}
            showGate={showInlineGate}
            gateEyebrow={gateCopy?.eyebrow}
            gateTitle={gateCopy?.title}
            gateDescription={gateCopy?.description}
            gateCtaLabel={gateCopy?.cta}
            onOpenGate={handleGateOpen}
          />
        ) : activeTab === "exam" ? (
          <ExamSimulationPage />
        ) : activeTab === "flashcard" ? (
          <FlashcardPage onSectionSelect={handleStudySectionSelect} />
        ) : activeTab === "spaced-repetition" ? (
          <SpacedRepetitionPage onSectionSelect={handleStudySectionSelect} />
        ) : (
          <FastFlashcardPage onSectionSelect={handleStudySectionSelect} />
        )}
      </main>
      <NoteModal
        isOpen={noteFilesDialogOpen}
        onClose={handleNoteModalClose}
        title={noteModalTitle}
      >
        {isExamNoteFiles ? (
          <ExamFilePanel
            files={examFiles}
            listState={examFilesState}
            listError={examFilesError}
            selectedFile={selectedExamFile}
            vaultPath={vault.vaultPath}
            onSelectFile={actions.handleSelectFile}
          />
        ) : (
          <NoteFilesPanel
            files={flashcardNoteFiles}
            listState={flashcardNoteFilesState}
            listError={flashcardNoteFilesError}
            selectedFile={preview.selectedFile}
            vaultPath={vault.vaultPath}
            onSelectFile={actions.handleSelectFile}
          />
        )}
      </NoteModal>
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
      <UserVaultCustomPathModal
        isOpen={openGateId === "custom-path"}
        onClose={handleGateClose}
        userVault={userVault}
      />
      <UserVaultProfileModal
        isOpen={openGateId === "profile"}
        onClose={handleGateClose}
        userVault={userVault}
      />
      <UserVaultSyncProviderModal
        isOpen={openGateId === "sync-provider"}
        onClose={handleGateClose}
        userVault={userVault}
      />
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
        <LayoutModeProvider>
          <AppContent />
        </LayoutModeProvider>
      </AppStateProvider>
    </AppErrorBoundary>
  );
}

export default App;
