/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/SpacedRepetitionPage.tsx
 *
 * Zweck:
 * - Rendert die Seite Spaced Repetition.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrCardHost.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrDeleteModal.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrHeader.tsx: UI-Komponente.
 *
 * Exportiert:
 * - SpacedRepetitionPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { SrCardHost } from "./components/SrCardHost";
import { SrDeleteModal } from "./components/SrDeleteModal";
import { SrHeader } from "./components/SrHeader";
import { SrStatsAndChart } from "./components/SrStatsAndChart";
import { SrStatsPanel } from "./components/SrStatsPanel";
import { SrToolsPanel } from "./components/SrToolsPanel";
import { UserToolsPanel } from "../../components/UserToolsPanel";
import { useSrSessionViewModel } from "./hooks/useSrSessionViewModel";

export const SpacedRepetitionPage = () => {
  const {
    flashcards,
    spacedRepetition,
    vault,
    isFocusMode,
    setIsFocusMode,
    activeBoxFilter,
    statsView,
    focusLabel,
    prevShortcutTitle,
    nextShortcutTitle,
    vaultName,
    showBoxEmptyMessage,
    statsChartClass,
    statsChartStyle,
    maxBoxCount,
    filteredFlashcardEntries,
    toggleBoxFilter,
    kpiItems,
    handleOptionSelect,
    handleTrueFalseSelect,
    handleClozeInputChange,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleTextInputChange,
    handleTextCheck,
    handleSelfGrade,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    handleDeleteOpen,
    handleDeleteCancel,
    handleDeleteConfirm,
    isDeleteDialogOpen,
    deleteConfirmInput,
    setDeleteConfirmInput,
    deleteTargetName,
    canConfirmDelete,
  } = useSrSessionViewModel();

  return (
    <div className={`spaced-repetition-layout ${isFocusMode ? "focus-mode" : ""}`}>
      {isFocusMode ? null : (
        <SrStatsAndChart
          statsView={statsView}
          setSpacedRepetitionStatsView={
            spacedRepetition.setSpacedRepetitionStatsView
          }
          spacedRepetitionBoxCounts={spacedRepetition.spacedRepetitionBoxCounts}
          maxBoxCount={maxBoxCount}
          activeBoxFilter={activeBoxFilter}
          toggleBoxFilter={toggleBoxFilter}
          vaultName={vaultName}
          vaultFilesCount={vault.files.length}
          spacedRepetitionFlashcardsLength={
            spacedRepetition.spacedRepetitionFlashcards.length
          }
          spacedRepetitionCompletedChartData={
            spacedRepetition.spacedRepetitionCompletedChartData
          }
          spacedRepetitionCompletedChartLabels={
            spacedRepetition.spacedRepetitionCompletedChartLabels
          }
          statsChartClass={statsChartClass}
          statsChartStyle={statsChartStyle}
          spacedRepetitionCorrectCount={spacedRepetition.spacedRepetitionCorrectCount}
          spacedRepetitionIncorrectCount={
            spacedRepetition.spacedRepetitionIncorrectCount
          }
          spacedRepetitionTotalQuestions={
            spacedRepetition.spacedRepetitionTotalQuestions
          }
        />
      )}

      {isFocusMode ? null : (
        <UserToolsPanel
          spacedRepetition={spacedRepetition}
          handleDeleteOpen={handleDeleteOpen}
          onStart={spacedRepetition.handleSpacedRepetitionActiveUserLoadCards}
          startDisabled={
            !spacedRepetition.spacedRepetitionActiveUser ||
            flashcards.isFlashcardScanning
          }
        />
      )}

      <section className="panel sr-flashcards-panel">
        <SrHeader
          spacedRepetitionStatusLabel={spacedRepetition.spacedRepetitionStatusLabel}
          isFocusMode={isFocusMode}
          focusLabel={focusLabel}
          setIsFocusMode={setIsFocusMode}
        />
        <SrCardHost
          filteredFlashcardEntries={filteredFlashcardEntries}
          showBoxEmptyMessage={showBoxEmptyMessage}
          activeBoxFilter={activeBoxFilter}
          spacedRepetitionEmptyState={spacedRepetition.spacedRepetitionEmptyState}
          spacedRepetitionSubmissions={spacedRepetition.spacedRepetitionSubmissions}
          spacedRepetitionCompositeStates={
            spacedRepetition.spacedRepetitionCompositeStates
          }
          spacedRepetitionClozeResponses={
            spacedRepetition.spacedRepetitionClozeResponses
          }
          spacedRepetitionTrueFalseSelections={
            spacedRepetition.spacedRepetitionTrueFalseSelections
          }
          spacedRepetitionTextResponses={
            spacedRepetition.spacedRepetitionTextResponses
          }
          spacedRepetitionTextRevealed={
            spacedRepetition.spacedRepetitionTextRevealed
          }
          spacedRepetitionSelfGrades={spacedRepetition.spacedRepetitionSelfGrades}
          spacedRepetitionSelections={spacedRepetition.spacedRepetitionSelections}
          handleCompositeOptionSelect={handleCompositeOptionSelect}
          handleCompositeTrueFalseSelect={handleCompositeTrueFalseSelect}
          handleCompositeClozeInputChange={handleCompositeClozeInputChange}
          handleCompositeClozeTokenDrop={handleCompositeClozeTokenDrop}
          handleCompositeClozeTokenRemove={handleCompositeClozeTokenRemove}
          handleCompositeTextInputChange={handleCompositeTextInputChange}
          handleCompositeTextCheck={handleCompositeTextCheck}
          handleCompositeSelfGrade={handleCompositeSelfGrade}
          handleOptionSelect={handleOptionSelect}
          handleTrueFalseSelect={handleTrueFalseSelect}
          handleClozeInputChange={handleClozeInputChange}
          handleClozeTokenDrop={handleClozeTokenDrop}
          handleClozeTokenRemove={handleClozeTokenRemove}
          handleTextInputChange={handleTextInputChange}
          handleTextCheck={handleTextCheck}
          handleSelfGrade={handleSelfGrade}
          handleSpacedRepetitionSubmit={
            spacedRepetition.handleSpacedRepetitionSubmit
          }
          handleClozeTokenDragStart={flashcards.handleClozeTokenDragStart}
          handleClozeBlankDragOver={flashcards.handleClozeBlankDragOver}
          spacedRepetitionCanGoBack={spacedRepetition.spacedRepetitionCanGoBack}
          spacedRepetitionCanGoNext={spacedRepetition.spacedRepetitionCanGoNext}
          handleSpacedRepetitionPageBack={
            spacedRepetition.handleSpacedRepetitionPageBack
          }
          handleSpacedRepetitionPageNext={
            spacedRepetition.handleSpacedRepetitionPageNext
          }
          prevShortcutTitle={prevShortcutTitle}
          nextShortcutTitle={nextShortcutTitle}
        />
      </section>

      {isFocusMode ? null : (
        <SrToolsPanel
          spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
          setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
          spacedRepetitionOrder={spacedRepetition.spacedRepetitionOrder}
          setSpacedRepetitionOrder={spacedRepetition.setSpacedRepetitionOrder}
          spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
          setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
        />
      )}

      {isFocusMode ? null : <SrStatsPanel kpiItems={kpiItems} />}

      <SrDeleteModal
        isDeleteDialogOpen={isDeleteDialogOpen}
        deleteTargetName={deleteTargetName}
        deleteConfirmInput={deleteConfirmInput}
        setDeleteConfirmInput={setDeleteConfirmInput}
        handleDeleteCancel={handleDeleteCancel}
        handleDeleteConfirm={handleDeleteConfirm}
        canConfirmDelete={canConfirmDelete}
      />
    </div>
  );
};
