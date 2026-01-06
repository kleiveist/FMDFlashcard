import { useCallback, useMemo, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { FastFlashcardToolsSettings } from "../components/settings/FastFlashcardToolsSettings";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import { ResetSessionHistoryModal } from "../components/settings/ResetSessionHistoryModal";
import {
  LanguageTabContent,
  DataSyncTabContent,
} from "../components/settings/DataSyncTabContent";
import { PerformanceTabContent } from "../components/settings/PerformanceTabContent";
import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection";
import { VaultIndexSection } from "../components/settings/VaultIndexSection";
import { FAST_FLASHCARD_DURATIONS } from "../features/fast-flashcard/constants";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";
import { resetFastFlashcardHistory } from "./fast-flashcard/hooks/useFastSession";

export const SettingsPage = () => {
  const {
    actions,
    flashcards,
    preview,
    settings,
    settingsNav,
    spacedRepetition,
    vault,
  } = useAppState();
  const { language, setLanguage } = settings;
  const lastOpenedFile = preview.selectedFile?.relative_path ?? null;
  const vaultIndexedComplete = useMemo(
    () => Boolean(vault.vaultPath) && vault.listState === "idle",
    [vault.listState, vault.vaultPath],
  );
  const handleLanguageChange = useCallback(
    (nextLanguage: "de" | "en") => {
      setLanguage(nextLanguage);
    },
    [setLanguage],
  );
  const [isResetHistoryOpen, setIsResetHistoryOpen] = useState(false);
  const [isResetHistoryPending, setIsResetHistoryPending] = useState(false);
  const { activeSettingsPage } = settingsNav;

  const handleResetHistoryConfirm = useCallback(async () => {
    setIsResetHistoryPending(true);
    const success = await resetFastFlashcardHistory();
    setIsResetHistoryPending(false);
    if (success) {
      setIsResetHistoryOpen(false);
    }
  }, [setIsResetHistoryOpen, resetFastFlashcardHistory]);

  return (
    <>
      <header className="content-header">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>Settings</h1>
          <p className="muted">
            Adjust your workflow. The next features build on this vault foundation.
          </p>
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={actions.handlePickVault}>
            Vault auswaehlen
          </button>
        </div>
      </header>
      {activeSettingsPage === "app-settings" ? (
        <div className="settings-page settings-app-grid" id="settings-page-app-settings">
          <VaultIndexSection
            lastOpenedFile={lastOpenedFile}
            listState={vault.listState}
            onCopyVaultPath={actions.handleCopyVaultPath}
            onRescanVault={actions.handleRescanVault}
            vaultIndexedComplete={vaultIndexedComplete}
            vaultPath={vault.vaultPath}
          />
          <section className="panel settings-performance-panel">
            <div className="panel-header">
              <div>
                <h2>Performance</h2>
                <p className="muted">Tune vault scans for larger libraries.</p>
              </div>
            </div>
            <div className="panel-body">
              <PerformanceTabContent
                maxFilesPerScan={settings.maxFilesPerScan}
                onMaxFilesPerScanChange={actions.handleMaxFilesPerScanChange}
                scanParallelism={settings.scanParallelism}
                setScanParallelism={settings.setScanParallelism}
              />
            </div>
          </section>
        </div>
      ) : null}
      {activeSettingsPage === "data-sync" ? (
        <div className="settings-page settings-single-column" id="settings-page-data-sync">
          <section className="panel settings-data-sync-panel">
            <div className="panel-header">
              <div>
                <h2>Data &amp; Sync</h2>
                <p className="muted">Storage and sync options will land here later.</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="settings-tab-content">
                <DataSyncTabContent />
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {activeSettingsPage === "review-tools" ? (
        <div className="settings-page settings-review-grid" id="settings-page-review-tools">
          <FlashcardsSettingsSection
            flashcardOrder={flashcards.flashcardOrder}
            flashcardPageSize={flashcards.flashcardPageSize}
            flashcardPageSizes={FLASHCARD_PAGE_SIZES}
            flashcardScope={flashcards.flashcardScope}
            setFlashcardOrder={flashcards.setFlashcardOrder}
            setFlashcardPageSize={flashcards.setFlashcardPageSize}
            setFlashcardScope={flashcards.setFlashcardScope}
            setSolutionRevealEnabled={flashcards.setSolutionRevealEnabled}
            setStatsResetMode={flashcards.setStatsResetMode}
            solutionRevealEnabled={flashcards.solutionRevealEnabled}
            statsResetMode={flashcards.statsResetMode}
          />
          <section className="panel fast-flashcard-tools-panel">
            <div className="panel-header">
              <div>
                <h2>Fast Flashcard Tools</h2>
                <p className="muted">Control fast flashcard ordering rules.</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="toolbar-section">
                <span className="label">Duration</span>
                <div className="pill-grid">
                  {FAST_FLASHCARD_DURATIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      className={`pill pill-button ${
                        settings.fastFlashcardDuration === duration ? "active" : ""
                      }`}
                      aria-pressed={settings.fastFlashcardDuration === duration}
                      onClick={() => settings.setFastFlashcardDuration(duration)}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
              </div>
              <FastFlashcardToolsSettings
                fastFlashcardOrder={settings.fastFlashcardOrder}
                fastFlashcardMode={settings.fastFlashcardMode}
                fastFlashcardScope={settings.fastFlashcardScope}
                setFastFlashcardOrder={settings.setFastFlashcardOrder}
                setFastFlashcardMode={settings.setFastFlashcardMode}
                setFastFlashcardScope={settings.setFastFlashcardScope}
                showSectionDividers
              />
              <div className="setting-row">
                <span className="label">Session History</span>
                <div className="setting-actions">
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setIsResetHistoryOpen(true)}
                  >
                    Reset history
                  </button>
                </div>
              </div>
            </div>
          </section>
          <SpacedRepetitionSettingsSection
            spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
            spacedRepetitionBoxOptions={SPACED_REPETITION_BOXES}
            spacedRepetitionOrder={spacedRepetition.spacedRepetitionOrder}
            spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
            spacedRepetitionPageSizes={SPACED_REPETITION_PAGE_SIZES}
            spacedRepetitionRepetitionStrength={
              spacedRepetition.spacedRepetitionRepetitionStrength
            }
            setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
            setSpacedRepetitionOrder={spacedRepetition.setSpacedRepetitionOrder}
            setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
            setSpacedRepetitionRepetitionStrength={
              spacedRepetition.setSpacedRepetitionRepetitionStrength
            }
          />
        </div>
      ) : null}
      {activeSettingsPage === "appearance" ? (
        <div className="settings-page settings-single-column" id="settings-page-appearance">
          <AppearanceSection
            accentColor={settings.accentColor}
            accentDraft={settings.accentDraft}
            accentError={settings.accentError}
            onAccentInputChange={actions.handleAccentInputChange}
            onAccentPick={actions.handleAccentPick}
            onCopyAccent={actions.handleCopyAccent}
            onThemeToggle={actions.handleThemeChange}
            theme={settings.theme}
          />
        </div>
      ) : null}
      {activeSettingsPage === "language" ? (
        <div className="settings-page settings-single-column" id="settings-page-language">
          <section className="panel settings-language-panel">
            <div className="panel-header">
              <div>
                <h2>Language</h2>
                <p className="muted">Set the app language.</p>
              </div>
            </div>
            <div className="panel-body">
              <LanguageTabContent
                language={language}
                onLanguageChange={handleLanguageChange}
              />
            </div>
          </section>
        </div>
      ) : null}
      <ResetSessionHistoryModal
        isOpen={isResetHistoryOpen}
        isPending={isResetHistoryPending}
        onCancel={() => setIsResetHistoryOpen(false)}
        onConfirm={handleResetHistoryConfirm}
      />
    </>
  );
};
