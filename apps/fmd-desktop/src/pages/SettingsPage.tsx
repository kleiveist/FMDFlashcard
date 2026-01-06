import { useCallback, useMemo, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { FastFlashcardToolsSettings } from "../components/settings/FastFlashcardToolsSettings";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import {
  LanguageTabContent,
  DataSyncTabContent,
} from "../components/settings/DataSyncTabContent";
import { PerformanceTabContent } from "../components/settings/PerformanceTabContent";
import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection";
import { VaultIndexSection } from "../components/settings/VaultIndexSection";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";

const APP_SETTINGS_TABS = [
  { id: "data-sync", label: "Data & Sync" },
  { id: "performance", label: "Performance" },
] as const;

type SettingsTabId = (typeof APP_SETTINGS_TABS)[number]["id"];

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
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTabId>("data-sync");
  const { activeSettingsPage } = settingsNav;

  return (
    <>
      <header className="content-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Einstellungen</h1>
          <p className="muted">
            Passe deinen Workflow an. Die naechsten Features bauen auf dieser
            Vault-Basis auf.
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
          <section className="panel settings-tabs-panel">
            <div className="panel-header">
              <div>
                <h2>Data &amp; Sync</h2>
                <p className="muted">
                  Manage storage and performance preferences here.
                </p>
              </div>
              <div className="pill-grid">
                {APP_SETTINGS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`pill pill-button ${
                      activeSettingsTab === tab.id ? "active" : ""
                    }`}
                    aria-pressed={activeSettingsTab === tab.id}
                    onClick={() => setActiveSettingsTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-body">
              <div className="settings-tab-content">
                {activeSettingsTab === "data-sync" ? (
                  <DataSyncTabContent />
                ) : (
                  <PerformanceTabContent
                    maxFilesPerScan={settings.maxFilesPerScan}
                    onMaxFilesPerScanChange={actions.handleMaxFilesPerScanChange}
                    scanParallelism={settings.scanParallelism}
                    setScanParallelism={settings.setScanParallelism}
                  />
                )}
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
              <FastFlashcardToolsSettings
                fastFlashcardOrder={settings.fastFlashcardOrder}
                fastFlashcardMode={settings.fastFlashcardMode}
                fastFlashcardScope={settings.fastFlashcardScope}
                setFastFlashcardOrder={settings.setFastFlashcardOrder}
                setFastFlashcardMode={settings.setFastFlashcardMode}
                setFastFlashcardScope={settings.setFastFlashcardScope}
                showSectionDividers
              />
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
    </>
  );
};
