/**
 * @file apps/fmd-desktop/src/pages/fast-flashcard/FastFlashcardPage.tsx
 *
 * Zweck:
 * - Rendert die Seite Fast Flashcard.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/fast-flashcard/components/FastCardHost.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/pages/fast-flashcard/components/FastHeader.tsx: UI-Komponente.
 *
 * Exportiert:
 * - FastFlashcardPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnchoredPopup } from "../../components/AnchoredPopup";
import { FastCardHost } from "./components/FastCardHost";
import { FastHeader } from "./components/FastHeader";
import { FastStatsPanel } from "./components/FastStatsPanel";
import { FastToolsPanel } from "./components/FastToolsPanel";
import { StudyTimeBar } from "../../components/StudyTimeBar";
import { NoteFilesPanel } from "../../components/NoteFilesPanel";
import { FileIcon, SettingsIcon } from "../../components/icons";
import { useFastSession } from "./hooks/useFastSession";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
  isFlashcardPartComplete,
} from "../../features/flashcards/logic";
import { requestSettingsFocus } from "../../features/settings/settingsDeepLink";
import {
  formatBinding,
  getEffectiveBinding,
  getShortcutPlatform,
  isEditableTarget,
  matchesBinding,
} from "../../lib/shortcuts/bindings";
import { getShortcutById } from "../../lib/shortcuts/registry";
import { useTableView } from "../../lib/useTableView";
import { useAppState } from "../../components/AppStateProvider";
import type { StudySectionKey } from "../../lib/studySections";

const viewToggleCommand = getShortcutById("toggleViewMode");
const studyPrevCommand = getShortcutById("studyPrevious");
const studyNextCommand = getShortcutById("studyNext");
const studySubmitCommand = getShortcutById("studySubmit");

type FastFlashcardPageProps = {
  onSectionSelect?: (section: StudySectionKey) => void;
};

export const FastFlashcardPage = ({ onSectionSelect }: FastFlashcardPageProps) => {
  const {
    actions,
    flashcardNoteFiles,
    flashcardNoteFilesError,
    flashcardNoteFilesState,
    preview,
    vault,
  } = useAppState();
  const {
    fastFlashcards,
    settings,
    orderedEntries,
    currentEntry,
    hasScannedCards,
    hasFilteredCards,
    isCurrentSubmitted,
    submissionLocked,
    timeRemaining,
    sessionElapsedMs,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleTextCheck,
    handleFastSubmit,
    handleFastSelfGrade,
    canGoBack,
    canGoNext,
    setFastCardPosition,
    statsCorrect,
    statsIncorrect,
    statsTotal,
    statsChartClass,
    statsChartStyle,
    isTimeModeEnabled,
    timeModeActive,
    handleTimeToggle,
    timeStatusLabel,
    timeProgressStyle,
    selectedDuration,
    activeDuration,
    setSelectedDuration,
    sessionStats,
    sessionCompleted,
    sessionMissed,
    sessionAccuracy,
    sessionPace,
    sessionScore,
    sessionMultiplier,
    sessionHistory,
    topSessions,
    lastSessions,
  } = useFastSession();
  const [isViewMode, setIsViewMode] = useState(false);
  const isTableView = useTableView();
  const isDesktopView = !isTableView;
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isNoteFilesPopupOpen, setIsNoteFilesPopupOpen] = useState(false);
  const noteFilesButtonRef = useRef<HTMLButtonElement | null>(null);
  const platform = getShortcutPlatform();
  const viewBinding = useMemo(() => {
    if (!viewToggleCommand) {
      return null;
    }
    return getEffectiveBinding(
      viewToggleCommand,
      settings.keyboardShortcuts.bindings,
      platform,
    );
  }, [platform, settings.keyboardShortcuts.bindings]);
  const viewShortcutLabel = viewBinding
    ? formatBinding(viewBinding, platform)
    : null;
  const viewLabel = viewShortcutLabel ? `View (${viewShortcutLabel})` : "View";
  const maxTimeMs = activeDuration * 1000;
  const elapsedMs =
    timeRemaining !== null
      ? Math.max(0, (activeDuration - timeRemaining) * 1000)
      : sessionElapsedMs;
  const studyBindings = useMemo(() => {
    const bindings = settings.keyboardShortcuts.bindings;
    return {
      prev: studyPrevCommand
        ? getEffectiveBinding(studyPrevCommand, bindings, platform)
        : null,
      next: studyNextCommand
        ? getEffectiveBinding(studyNextCommand, bindings, platform)
        : null,
      submit: studySubmitCommand
        ? getEffectiveBinding(studySubmitCommand, bindings, platform)
        : null,
    };
  }, [platform, settings.keyboardShortcuts.bindings]);

  useEffect(() => {
    document.body.classList.toggle("focus-mode", isViewMode);
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [isViewMode]);

  useEffect(() => {
    if (isDesktopView && !isViewMode) {
      return;
    }
    setIsNoteFilesPopupOpen(false);
  }, [isDesktopView, isViewMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const isEditable = isEditableTarget(event.target);
      if (!viewToggleCommand || !viewBinding) {
        return;
      }
      if (!viewToggleCommand.allowInTextInputs && isEditable) {
        return;
      }
      if (!matchesBinding(event, viewBinding)) {
        return;
      }
      event.preventDefault();
      setIsViewMode((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewBinding]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const isEditable = isEditableTarget(event.target);
      const canTrigger = (
        command:
          | typeof studyPrevCommand
          | typeof studyNextCommand
          | typeof studySubmitCommand,
        binding: string | null,
      ) => {
        if (!command || !binding) {
          return false;
        }
        if (!command.allowInTextInputs && isEditable) {
          return false;
        }
        return matchesBinding(event, binding);
      };

      if (canTrigger(studyPrevCommand, studyBindings.prev)) {
        event.preventDefault();
        if (canGoBack) {
          setFastCardPosition((prev) => Math.max(0, prev - 1));
        }
        return;
      }

      if (canTrigger(studyNextCommand, studyBindings.next)) {
        event.preventDefault();
        if (canGoNext) {
          setFastCardPosition((prev) => prev + 1);
        }
        return;
      }

      if (!canTrigger(studySubmitCommand, studyBindings.submit)) {
        return;
      }

      if (!currentEntry || isCurrentSubmitted) {
        return;
      }

      const { card, cardIndex } = currentEntry;
      if (card.kind === "composite") {
        const partStates = fastFlashcards.flashcardCompositeStates[cardIndex] ?? [];
        const canSubmit =
          card.parts.length > 0 &&
          card.parts.every((part, partIndex) =>
            isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
          );
        if (!canSubmit) {
          return;
        }
      } else if (card.kind === "multiple-choice") {
        if ((fastFlashcards.flashcardSelections[cardIndex] ?? []).length === 0) {
          return;
        }
      } else if (card.kind === "true-false") {
        const selections = fastFlashcards.flashcardTrueFalseSelections[cardIndex] ?? {};
        if (!areTrueFalseItemsComplete(card, selections)) {
          return;
        }
      } else if (card.kind === "free-text") {
        return;
      } else {
        const responses = fastFlashcards.flashcardClozeResponses[cardIndex] ?? {};
        if (!areClozeBlanksComplete(card, responses)) {
          return;
        }
      }

      event.preventDefault();
      handleFastSubmit(cardIndex, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canGoBack,
    canGoNext,
    currentEntry,
    fastFlashcards.flashcardClozeResponses,
    fastFlashcards.flashcardCompositeStates,
    fastFlashcards.flashcardSelections,
    fastFlashcards.flashcardTrueFalseSelections,
    handleFastSubmit,
    isCurrentSubmitted,
    setFastCardPosition,
    studyBindings,
  ]);

  const statsHeaderActions =
    isDesktopView && !isViewMode ? (
      <div className="study-header-quick-actions">
        <button
          ref={noteFilesButtonRef}
          type="button"
          className={`ghost small study-header-quick-action-button ${
            isNoteFilesPopupOpen ? "active" : ""
          }`}
          onClick={() => setIsNoteFilesPopupOpen((prev) => !prev)}
          aria-label="Note Files"
          aria-haspopup="dialog"
          aria-expanded={isNoteFilesPopupOpen}
          title="Note Files"
        >
          <span className="study-header-quick-action-icon" aria-hidden="true">
            <FileIcon />
          </span>
        </button>
        <button
          type="button"
          className="ghost small study-header-quick-action-button"
          onClick={() => {
            setIsNoteFilesPopupOpen(false);
            requestSettingsFocus({
              pageId: "review-tools",
              subPageId: "fast-flashcard-tools",
              scrollSelector: ".fast-flashcard-tools-panel",
              highlight: true,
            });
          }}
          aria-label="Fast Flashcard Tools"
          title="Fast Flashcard Tools"
        >
          <span className="study-header-quick-action-icon" aria-hidden="true">
            <SettingsIcon />
          </span>
        </button>
      </div>
    ) : null;

  const statsPanel = (
    <FastStatsPanel
      isTimeModeEnabled={isTimeModeEnabled}
      timeModeActive={timeModeActive}
      timeStatusLabel={timeStatusLabel}
      timeProgressStyle={timeProgressStyle}
      selectedDuration={activeDuration}
      statsChartClass={statsChartClass}
      statsChartStyle={statsChartStyle}
      statsCorrect={statsCorrect}
      statsIncorrect={statsIncorrect}
      statsTotal={statsTotal}
      sessionStats={sessionStats}
      sessionHistory={sessionHistory}
      topSessions={topSessions}
      lastSessions={lastSessions}
      sessionCompleted={sessionCompleted}
      sessionMissed={sessionMissed}
      sessionAccuracy={sessionAccuracy}
      sessionPace={sessionPace}
      sessionScore={sessionScore}
      sessionMultiplier={sessionMultiplier}
      handleTimeToggle={handleTimeToggle}
      isCollapsible={isTableView}
      isCollapsed={isTableView && !isStatsOpen}
      onToggleCollapse={() => setIsStatsOpen((prev) => !prev)}
      controlsId="fast-stats-body"
      headerActions={statsHeaderActions}
    />
  );

  const toolsPanel = (
    <FastToolsPanel
      fastFlashcards={fastFlashcards}
      settings={settings}
      selectedDuration={selectedDuration}
      setSelectedDuration={setSelectedDuration}
      isTimeModeEnabled={isTimeModeEnabled}
      isCollapsible={isTableView}
      isCollapsed={isTableView && !isToolsOpen}
      onToggleCollapse={() => setIsToolsOpen((prev) => !prev)}
      controlsId="fast-tools-body"
    />
  );

  const noteFilesPanel = (
    <NoteFilesPanel
      className="fast-note-files-panel"
      files={flashcardNoteFiles}
      listState={flashcardNoteFilesState}
      listError={flashcardNoteFilesError}
      selectedFile={preview.selectedFile}
      vaultPath={vault.vaultPath}
      onSelectFile={actions.handleSelectFile}
    />
  );

  const flashcardPanel = (
    <section className="panel fast-flashcard-panel">
      {isViewMode ? (
        <StudyTimeBar
          elapsedMs={elapsedMs}
          maxMs={maxTimeMs}
          isRunning={timeModeActive}
        />
      ) : null}
      <FastHeader
        hasScannedCards={hasScannedCards}
        isViewMode={isViewMode}
        onToggleView={() => setIsViewMode((prev) => !prev)}
        viewLabel={viewLabel}
        onSectionSelect={onSectionSelect}
        isTimeModeEnabled={isTimeModeEnabled}
        onTimeToggle={handleTimeToggle}
        showTimeToggle={isTableView}
      />
      {isTableView ? (
        <div className="fast-time-block fast-time-block--compact">
          <div className="fast-time-meter" style={timeProgressStyle} aria-hidden="true" />
        </div>
      ) : null}
      <FastCardHost
        hasScannedCards={hasScannedCards}
        hasFilteredCards={hasFilteredCards}
        currentEntry={currentEntry}
        isCurrentSubmitted={isCurrentSubmitted}
        submissionLocked={submissionLocked}
        helpEnabled={settings.fastFlashcardHelpEnabled}
        vaultPath={vault.vaultPath}
        vaultPngAssets={vault.pngAssets}
        fastFlashcards={fastFlashcards}
        orderedEntries={orderedEntries}
        canGoBack={canGoBack}
        canGoNext={canGoNext}
        setFastCardPosition={setFastCardPosition}
        handleOptionSelect={handleOptionSelect}
        handleTrueFalseSelect={handleTrueFalseSelect}
        handleClozeInputChange={handleClozeInputChange}
        handleClozeTokenDrop={handleClozeTokenDrop}
        handleClozeTokenRemove={handleClozeTokenRemove}
        handleTextInputChange={handleTextInputChange}
        handleTextCheck={handleTextCheck}
        handleCompositeOptionSelect={handleCompositeOptionSelect}
        handleCompositeTrueFalseSelect={handleCompositeTrueFalseSelect}
        handleCompositeClozeInputChange={handleCompositeClozeInputChange}
        handleCompositeClozeTokenDrop={handleCompositeClozeTokenDrop}
        handleCompositeClozeTokenRemove={handleCompositeClozeTokenRemove}
        handleCompositeTextInputChange={handleCompositeTextInputChange}
        handleCompositeTextCheck={handleCompositeTextCheck}
        handleCompositeSelfGrade={handleCompositeSelfGrade}
        handleFastSubmit={handleFastSubmit}
        handleFastSelfGrade={handleFastSelfGrade}
      />
    </section>
  );

  return (
    <div
      className={`fast-flashcard-layout ${
        isDesktopView ? "desktop-rail-layout" : ""
      } ${isViewMode ? "focus-mode" : ""} ${
        isTableView ? "table-view" : ""
      }`}
    >
      <div className="fast-flashcard-main">
        {statsPanel}
        {flashcardPanel}
      </div>
      {isDesktopView ? (
        null
      ) : (
        <aside className="fast-flashcard-sidebar">
          {noteFilesPanel}
          {toolsPanel}
        </aside>
      )}
      <AnchoredPopup
        isOpen={isDesktopView && !isViewMode && isNoteFilesPopupOpen}
        onClose={() => setIsNoteFilesPopupOpen(false)}
        anchorRef={noteFilesButtonRef}
        closeLayerId="fast-flashcard-note-files"
        ariaLabel="Fast flashcard note files"
        mode="centered"
        showBackdrop
        className="note-files-popup"
      >
        {noteFilesPanel}
      </AnchoredPopup>
    </div>
  );
};
