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

import { FastCardHost } from "./components/FastCardHost";
import { FastHeader } from "./components/FastHeader";
import { FastHistoryPanel } from "./components/FastHistoryPanel";
import { FastStatsPanel } from "./components/FastStatsPanel";
import { FastToolsPanel } from "./components/FastToolsPanel";
import { useFastSession } from "./hooks/useFastSession";

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

  return (
    <div className="fast-flashcard-layout">
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
        <FastHeader hasScannedCards={hasScannedCards} />
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
