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
import { CursorAccessoryOverlay } from "./components/CursorAccessoryOverlay";
import { SidebarNav } from "./components/SidebarNav";
import { StudySectionNav } from "./components/StudySectionNav";
import {
  UserVaultCustomPathModal,
  UserVaultProfileModal,
  UserVaultSyncProviderModal,
} from "./components/UserVaultGateModals";
import { UserListSection } from "./components/settings/ProfileSetupSections";
import { LayoutModeProvider, useLayoutMode } from "./lib/layoutMode";
import { useMediaQuery } from "./lib/useMediaQuery";
import type { VaultFile } from "./lib/tree";
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
import { useInputDebugInstrumentation } from "./features/input-debug/useInputDebug";
import { subscribeSettingsFocus } from "./features/settings/settingsDeepLink";
import type { PreviewFileOpenOptions } from "./features/preview/usePreview";
import {
  CardMonitoringPage,
  type CardMonitoringPageHandle,
} from "./pages/CardMonitoringPage";
import { DashboardPage, type DashboardPageHandle, type DashboardView } from "./pages/DashboardPage";
import { ExamSimulationPage } from "./pages/ExamSimulationPage";
import { FlashcardPage } from "./pages/FlashcardPage";
import { FastFlashcardPage } from "./pages/FastFlashcardPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";
import { DEFAULT_HELP_TOPIC_ID } from "./pages/help/helpContent";
import type { StudySectionKey } from "./lib/studySections";
import { SMART_QUERY } from "./lib/breakpoints";

type WalletGateId = "custom-path" | "profile" | "sync-provider";
const isTaskAreaTab = (tab: StudySectionKey) =>
  tab === "flashcard" || tab === "fast-flashcard" || tab === "spaced-repetition";

const AppContent = () => {
  const {
    actions,
    flashcardNoteFiles,
    flashcardNoteFilesError,
    flashcardNoteFilesState,
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
  useInputDebugInstrumentation({
    enabled: settings.inputDebugEnabled,
    redactContent: settings.inputDebugRedactContent,
  });
  const [activeTab, setActiveTab] = useState<StudySectionKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>("markdown");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteDialogSection, setNoteDialogSection] = useState<StudySectionKey | null>(
    null,
  );
  const dashboardRef = useRef<DashboardPageHandle | null>(null);
  const cardMonitoringRef = useRef<CardMonitoringPageHandle | null>(null);
  const noteButtonRef = useRef<HTMLButtonElement | null>(null);
  const noteWasOpenRef = useRef(false);
  const prevTabRef = useRef<StudySectionKey>(activeTab);
  const prevDashboardViewRef = useRef<DashboardView>(dashboardView);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserRegistryModalOpen, setIsUserRegistryModalOpen] = useState(false);
  const [openGateId, setOpenGateId] = useState<WalletGateId | null>(null);
  const [dismissedGateId, setDismissedGateId] = useState<WalletGateId | null>(null);
  const isDashboard = activeTab === "dashboard";
  const platform = getShortcutPlatform();
  const layoutMode = useLayoutMode();
  const showStudySectionNav = layoutMode === "table";
  const isToolbarCollapsed = layoutMode === "table";
  const isNoteViewport = useMediaQuery(SMART_QUERY, false);
  const isExamNoteViewport = useMediaQuery(SMART_QUERY, false);
  const isDashboardNoteEligible =
    activeTab === "dashboard" &&
    (dashboardView === "markdown" || dashboardView === "exam") &&
    isNoteViewport;
  const isSectionNoteEligible =
    activeTab !== "dashboard" &&
    (activeTab === "exam" ? isExamNoteViewport : isNoteViewport);
  const isNoteModalEligible = isDashboardNoteEligible || isSectionNoteEligible;
  const isExamRunSummaryNoteTriggerEnabled = activeTab === "exam" && isExamNoteViewport;
  const showStudySectionNoteAction =
    isNoteModalEligible && !isExamRunSummaryNoteTriggerEnabled;
  const noteFilesDialogOpen = Boolean(
    isNoteModalOpen &&
      noteDialogSection &&
      noteDialogSection !== "dashboard" &&
      noteDialogSection !== "exam",
  );
  const closeCommand = useMemo(() => getShortcutById("uiCloseOrBack"), []);
  const closeBinding = useMemo(
    () =>
      closeCommand
        ? getEffectiveBinding(closeCommand, settings.keyboardShortcuts.bindings, platform)
        : null,
    [closeCommand, platform, settings.keyboardShortcuts.bindings],
  );
  const activeUserName = spacedRepetition.spacedRepetitionActiveUser?.trim() ?? "";
  const isWalletOpen = Boolean(vault.vaultPath);
  const isActivePathReady =
    Boolean(userVault.resolvedPath) && userVault.status !== "error";
  const isProfileReady = Boolean(
    spacedRepetition.spacedRepetitionActiveUserId && activeUserName,
  );
  const syncProviderEnabled = isSyncProviderEnabled();
  const syncProviderRequired = false; // TODO: enable when product rule requires sync setup.
  const syncProviderConfigured = false; // TODO: wire to persisted sync provider config.
  const shouldGateSyncProvider =
    syncProviderEnabled && syncProviderRequired && !syncProviderConfigured;
  const needsCustomPathSetup = userVault.mode === "custom" && !isActivePathReady;
  const nextGate: WalletGateId | null = !isWalletOpen
    ? null
    : needsCustomPathSetup
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
          eyebrow: "User required",
          title: "Create a user to continue",
          description:
            "Your progress is stored per user. Create or load a user to continue working in this vault.",
          cta: "Create user",
        },
        "sync-provider": {
          eyebrow: "Sync provider",
          title: "Configure sync provider",
          description: "Set up a sync provider to continue.",
          cta: "Configure sync",
        },
      }[nextGate]
    : null;
  const profileSetupVaultSelection = useMemo(
    () => ({
      activeVaultPath: vault.vaultPath,
      recentVaultPaths: settings.recentVaults.map((entry) => entry.path),
      onSelectVault: actions.handleSwitchVault,
      onPickVault: actions.handlePickVault,
      isVaultBusy: vault.listState === "loading",
    }),
    [
      actions.handlePickVault,
      actions.handleSwitchVault,
      settings.recentVaults,
      vault.listState,
      vault.vaultPath,
    ],
  );
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
    async (tab: StudySectionKey) => {
      if (
        activeTab === "dashboard" &&
        tab !== "dashboard" &&
        dashboardRef.current
      ) {
        const canLeaveDashboard =
          await dashboardRef.current.requestLeaveDashboard();
        if (!canLeaveDashboard) {
          return false;
        }
      }
      if (
        activeTab === "card-monitoring" &&
        tab !== "card-monitoring" &&
        cardMonitoringRef.current
      ) {
        const canLeaveCardMonitoring =
          await cardMonitoringRef.current.requestLeaveCardMonitoring();
        if (!canLeaveCardMonitoring) {
          return false;
        }
      }
      if (tab !== activeTab && isTaskAreaTab(activeTab)) {
        await actions.flushPendingTaskAreaToggles(
          `tab-change:${activeTab}->${tab}`,
        );
      }
      setActiveTab(tab);
      setIsMobileNavOpen(false);
      return true;
    },
    [actions, activeTab, setActiveTab, setIsMobileNavOpen],
  );
  const handleStudySectionSelect = useCallback(
    (tab: StudySectionKey) => {
      void (async () => {
        if (tab === "dashboard") {
          const nextView: DashboardView =
            dashboardView === "markdown" ? "exam" : "markdown";
          requestDashboardViewChange(nextView);
          await handleTabChange("dashboard");
          return;
        }
        const changed = await handleTabChange(tab);
        if (!changed) {
          return;
        }
        if (tab === "flashcard" && !flashcards.isFlashcardScanning) {
          void flashcards.handleFlashcardScan();
        } else if (
          tab === "fast-flashcard" &&
          !fastFlashcards.isFlashcardScanning
        ) {
          void fastFlashcards.handleFlashcardScan();
        } else if (
          tab === "spaced-repetition" &&
          !flashcards.isFlashcardScanning &&
          spacedRepetition.spacedRepetitionActiveUser
        ) {
          void spacedRepetition.handleSpacedRepetitionActiveUserLoadCards();
        }
      })();
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
  const handleSidebarTabChange = useCallback(
    (tab: StudySectionKey) => {
      if (tab === "dashboard") {
        void handleTabChange(tab);
        return;
      }
      void handleStudySectionSelect(tab);
    },
    [handleStudySectionSelect, handleTabChange],
  );
  const handleSidebarVaultFileSelect = useCallback(
    (file: VaultFile, options?: PreviewFileOpenOptions) => {
      void (async () => {
        if (activeTab === "dashboard" && dashboardRef.current) {
          const canLeaveDashboard =
            await dashboardRef.current.requestLeaveDashboard();
          if (!canLeaveDashboard) {
            return;
          }
        }
        actions.handleSelectFile(file, options);
      })();
    },
    [actions, activeTab],
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

  const handleOpenExamFileInMarkdownEditor = useCallback(
    (file: VaultFile, options?: PreviewFileOpenOptions) => {
      actions.handleSelectFile(file, options);
      setDashboardView("markdown");
      setActiveTab("dashboard");
      setIsMobileNavOpen(false);
      handleNoteModalClose();
    },
    [actions, handleNoteModalClose],
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

  const noteModalTitle = "Note";

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

  const handleOpenUserManager = useCallback(() => {
    setIsUserRegistryModalOpen(true);
  }, []);

  const handleCloseUserManager = useCallback(() => {
    setIsUserRegistryModalOpen(false);
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
      data-active-tab={activeTab}
      data-study-subview={dashboardView}
    >
      {showStudySectionNav ? (
        <StudySectionNav
          activeTab={activeTab}
          onSectionSelect={handleStudySectionSelect}
          isMobileNavOpen={isMobileNavOpen}
          onMobileNavOpen={() => setIsMobileNavOpen(true)}
          showNoteAction={showStudySectionNoteAction}
          onNoteAction={handleNoteModalOpen}
          noteActionRef={noteButtonRef}
          isNoteActionActive={isNoteModalOpen}
        />
      ) : null}
      <SidebarNav
        activeTab={activeTab}
        onTabChange={handleSidebarTabChange}
        onSelectVaultFile={handleSidebarVaultFileSelect}
        vaultView={dashboardView}
        onVaultViewChange={requestDashboardViewChange}
        onOpenHelp={handleOpenHelp}
        onOpenSettings={handleOpenSettings}
        onOpenUserManager={handleOpenUserManager}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
      />
      <main className="content">
        <div className="mobile-nav-header">
          {!showStudySectionNav ? (
            <button
              type="button"
              className={`ghost small mobile-nav-toggle ${
                activeTab === "exam" ? "exam-mobile-nav-toggle" : ""
              }`}
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
          <ExamSimulationPage
            runSummaryNoteActionEnabled={isExamRunSummaryNoteTriggerEnabled}
            onRunSummaryNoteAction={handleNoteModalOpen}
            isRunSummaryNoteActionActive={
              isNoteModalOpen && noteDialogSection === "exam"
            }
            isExamFilesNoteOpen={isNoteModalOpen && noteDialogSection === "exam"}
            onCloseExamFilesNote={handleNoteModalClose}
            onOpenExamFileInMarkdownEditor={handleOpenExamFileInMarkdownEditor}
          />
        ) : activeTab === "flashcard" ? (
          <FlashcardPage onSectionSelect={handleStudySectionSelect} />
        ) : activeTab === "card-monitoring" ? (
          <CardMonitoringPage ref={cardMonitoringRef} />
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
        panelClassName="note-files-modal-panel"
        bodyClassName="note-files-modal-body"
      >
        <NoteFilesPanel
          files={flashcardNoteFiles}
          listState={flashcardNoteFilesState}
          listError={flashcardNoteFilesError}
          selectedFile={preview.selectedFile}
          vaultPath={vault.vaultPath}
          onSelectFile={actions.handleSelectFile}
        />
      </NoteModal>
      <ModalShell isOpen={isHelpOpen} title="Help" onClose={handleCloseHelp}>
        <div className="hub-modal-scroll">
          <HelpPage onCloseHelp={handleCloseHelp} />
        </div>
      </ModalShell>
      <ModalShell
        isOpen={isSettingsOpen}
        title="Settings"
        onClose={handleCloseSettings}
        className="settings-modal-panel"
        bodyClassName="settings-modal-body"
      >
        <SettingsPage />
      </ModalShell>
      <ModalShell
        isOpen={isUserRegistryModalOpen}
        title="Manage User"
        onClose={handleCloseUserManager}
        bodyClassName="hub-modal-scroll"
      >
        <section className="panel sr-user-panel">
          <div className="panel-header">
            <div>
              <h2>User Tools</h2>
            </div>
          </div>
          <div className="panel-body">
            <UserListSection
              userVault={userVault}
              spacedRepetition={spacedRepetition}
              showActiveUser
            />
          </div>
        </section>
      </ModalShell>
      <UserVaultCustomPathModal
        isOpen={openGateId === "custom-path"}
        onClose={handleGateClose}
        userVault={userVault}
        spacedRepetition={spacedRepetition}
        vaultSelection={profileSetupVaultSelection}
      />
      <UserVaultProfileModal
        isOpen={openGateId === "profile"}
        onClose={handleGateClose}
        userVault={userVault}
        spacedRepetition={spacedRepetition}
        vaultSelection={profileSetupVaultSelection}
      />
      <UserVaultSyncProviderModal
        isOpen={openGateId === "sync-provider"}
        onClose={handleGateClose}
        userVault={userVault}
        spacedRepetition={spacedRepetition}
        vaultSelection={profileSetupVaultSelection}
      />
      <CursorAccessoryOverlay enabled={settings.cursorAccessoryEnabled} />
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
