import { useCallback, useMemo } from "react";
import { useAppState } from "../components/AppStateProvider";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { DataSyncSection } from "../components/settings/DataSyncSection";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import { PerformanceSection } from "../components/settings/PerformanceSection";
import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection";
import { VaultIndexSection } from "../components/settings/VaultIndexSection";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";

export const SettingsPage = () => {
  const { actions, flashcards, preview, settings, spacedRepetition, vault } =
    useAppState();
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
      <div className="settings-grid">
        <VaultIndexSection
          lastOpenedFile={lastOpenedFile}
          listState={vault.listState}
          onCopyVaultPath={actions.handleCopyVaultPath}
          onRescanVault={actions.handleRescanVault}
          vaultIndexedComplete={vaultIndexedComplete}
          vaultPath={vault.vaultPath}
        />
        <DataSyncSection
          language={language}
          onLanguageChange={handleLanguageChange}
        />
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
        <SpacedRepetitionSettingsSection
          spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
          spacedRepetitionBoxOptions={SPACED_REPETITION_BOXES}
          spacedRepetitionOrder={spacedRepetition.spacedRepetitionOrder}
          spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
          spacedRepetitionPageSizes={SPACED_REPETITION_PAGE_SIZES}
          setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
          setSpacedRepetitionOrder={spacedRepetition.setSpacedRepetitionOrder}
          setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
        />
        <PerformanceSection
          maxFilesPerScan={settings.maxFilesPerScan}
          onMaxFilesPerScanChange={actions.handleMaxFilesPerScanChange}
          scanParallelism={settings.scanParallelism}
          setScanParallelism={settings.setScanParallelism}
        />
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
    </>
  );
};
