import { useCallback, useMemo, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { ExamSettingsSection } from "../components/settings/ExamSettingsSection";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import { ResetSessionHistoryModal } from "../components/settings/ResetSessionHistoryModal";
import { LanguageTabContent } from "../components/settings/DataSyncTabContent";
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
      {activeSettingsPage === "review-tools" ? (
        <div className="settings-page settings-review-grid" id="settings-page-review-tools">
          <FlashcardsSettingsSection
            flashcardMode={flashcards.flashcardMode}
            flashcardOrder={flashcards.flashcardOrder}
            flashcardPageSize={flashcards.flashcardPageSize}
            flashcardPageSizes={FLASHCARD_PAGE_SIZES}
            flashcardScope={flashcards.flashcardScope}
            setFlashcardMode={flashcards.setFlashcardMode}
            setFlashcardOrder={flashcards.setFlashcardOrder}
            setFlashcardPageSize={flashcards.setFlashcardPageSize}
            setFlashcardScope={flashcards.setFlashcardScope}
            setStatsResetMode={flashcards.setStatsResetMode}
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
              <div className="setting-row">
                <span className="label">DEFAULT ORDER</span>
                <div className="pill-grid">
                  <button
                    type="button"
                    className={`pill pill-button ${
                      settings.fastFlashcardOrder === "in-order" ? "active" : ""
                    }`}
                    aria-pressed={settings.fastFlashcardOrder === "in-order"}
                    onClick={() => settings.setFastFlashcardOrder("in-order")}
                  >
                    In order
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${
                      settings.fastFlashcardOrder === "random" ? "active" : ""
                    }`}
                    aria-pressed={settings.fastFlashcardOrder === "random"}
                    onClick={() => settings.setFastFlashcardOrder("random")}
                  >
                    Random
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span className="label">MODE</span>
                <select
                  className="text-input"
                  value={settings.fastFlashcardMode}
                  onChange={(event) =>
                    settings.setFastFlashcardMode(
                      event.target.value as typeof settings.fastFlashcardMode,
                    )
                  }
                  aria-label="Select mode filter"
                >
                  <option value="all">All</option>
                  <option value="qa">Q&amp;A</option>
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="fill-blank">Fill-in-the-blank</option>
                  <option value="assignment">Assignment</option>
                  <option value="true-false">True/False</option>
                  <option value="mix">Mix</option>
                </select>
              </div>
              <div className="setting-row">
                <span className="label">DURATION</span>
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
              <div className="setting-row">
                <span className="label">DEFAULT SCOPE</span>
                <div className="pill-grid">
                  <button
                    type="button"
                    className={`pill pill-button ${
                      settings.fastFlashcardScope === "current" ? "active" : ""
                    }`}
                    aria-pressed={settings.fastFlashcardScope === "current"}
                    onClick={() => settings.setFastFlashcardScope("current")}
                  >
                    Current note
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${
                      settings.fastFlashcardScope === "vault" ? "active" : ""
                    }`}
                    aria-pressed={settings.fastFlashcardScope === "vault"}
                    onClick={() => settings.setFastFlashcardScope("vault")}
                  >
                    Whole vault
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span className="label">SESSION HISTORY</span>
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
          <ExamSettingsSection
            maxTotalPoints={settings.examMaxTotalPoints}
            taskCount={settings.examTaskCount}
            taskPoints={settings.examTaskPoints}
            aiEvaluation={settings.examAiEvaluation}
            setMaxTotalPoints={settings.setExamMaxTotalPoints}
            setTaskCount={settings.setExamTaskCount}
            setTaskPoints={settings.setExamTaskPoints}
          />
        </div>
      ) : null}
      {activeSettingsPage === "appearance" ? (
        <div className="settings-page settings-single-column" id="settings-page-appearance">
          <AppearanceSection
            accentColor={settings.accentColor}
            accentDraft={settings.accentDraft}
            accentError={settings.accentError}
            editorExactColors={settings.editorExactColors}
            editorBlueprintGrid={settings.editorBlueprintGrid}
            editorBlueprintGridIntensity={settings.editorBlueprintGridIntensity}
            onAccentInputChange={actions.handleAccentInputChange}
            onAccentPick={actions.handleAccentPick}
            onCopyAccent={actions.handleCopyAccent}
            onEditorExactColorsToggle={settings.setEditorExactColors}
            onEditorBlueprintGridToggle={settings.setEditorBlueprintGrid}
            onEditorBlueprintGridIntensityChange={
              settings.setEditorBlueprintGridIntensity
            }
            onThemeToggle={actions.handleThemeChange}
            theme={settings.theme}
          />
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
