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
 * - apps/fmd-desktop/src/pages/fast-flashcard/components/FastHistoryPanel.tsx: UI-Komponente.
 *
 * Exportiert:
 * - FastFlashcardPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useEffect, useMemo, useState } from "react";
import { FastCardHost } from "./components/FastCardHost";
import { FastHeader } from "./components/FastHeader";
import { FastHistoryPanel } from "./components/FastHistoryPanel";
import { FastStatsPanel } from "./components/FastStatsPanel";
import { FastToolsPanel } from "./components/FastToolsPanel";
import { StudyTimeBar } from "../../components/StudyTimeBar";
import { useFastSession } from "./hooks/useFastSession";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
  isFlashcardPartComplete,
} from "../../features/flashcards/logic";
import {
  formatBinding,
  getEffectiveBinding,
  getShortcutPlatform,
  isEditableTarget,
  matchesBinding,
} from "../../lib/shortcuts/bindings";
import { getShortcutById } from "../../lib/shortcuts/registry";

const viewToggleCommand = getShortcutById("toggleViewMode");
const studyPrevCommand = getShortcutById("studyPrevious");
const studyNextCommand = getShortcutById("studyNext");
const studySubmitCommand = getShortcutById("studySubmit");

export const FastFlashcardPage = () => {
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
  const maxTimeMs = selectedDuration * 1000;
  const elapsedMs =
    timeRemaining !== null
      ? Math.max(0, (selectedDuration - timeRemaining) * 1000)
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

  return (
    <div className={`fast-flashcard-layout ${isViewMode ? "focus-mode" : ""}`}>
      <FastStatsPanel
        isTimeModeEnabled={isTimeModeEnabled}
        timeModeActive={timeModeActive}
        timeStatusLabel={timeStatusLabel}
        timeProgressStyle={timeProgressStyle}
        selectedDuration={selectedDuration}
        statsChartClass={statsChartClass}
        statsChartStyle={statsChartStyle}
        statsCorrect={statsCorrect}
        statsIncorrect={statsIncorrect}
        statsTotal={statsTotal}
        sessionStats={sessionStats}
        sessionCompleted={sessionCompleted}
        sessionMissed={sessionMissed}
        sessionAccuracy={sessionAccuracy}
        sessionPace={sessionPace}
        sessionScore={sessionScore}
        sessionMultiplier={sessionMultiplier}
        handleTimeToggle={handleTimeToggle}
      />
      <FastToolsPanel
        fastFlashcards={fastFlashcards}
        settings={settings}
        selectedDuration={selectedDuration}
        setSelectedDuration={setSelectedDuration}
        isTimeModeEnabled={isTimeModeEnabled}
      />
      <FastHistoryPanel
        sessionHistory={sessionHistory}
        topSessions={topSessions}
        lastSessions={lastSessions}
      />
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
        />
        <FastCardHost
          hasScannedCards={hasScannedCards}
          hasFilteredCards={hasFilteredCards}
          currentEntry={currentEntry}
          isCurrentSubmitted={isCurrentSubmitted}
          submissionLocked={submissionLocked}
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
    </div>
  );
};
