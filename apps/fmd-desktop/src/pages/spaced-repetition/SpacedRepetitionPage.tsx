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

import { useState } from "react";
import { SrCardHost } from "./components/SrCardHost";
import { SrDeleteModal } from "./components/SrDeleteModal";
import { SrHeader } from "./components/SrHeader";
import { SrStatsAndChart } from "./components/SrStatsAndChart";
import { SrToolsPanel } from "./components/SrToolsPanel";
import { UserToolsPanel } from "../../components/UserToolsPanel";
import { NoteFilesPanel } from "../../components/NoteFilesPanel";
import { useSrSessionViewModel } from "./hooks/useSrSessionViewModel";
import { useTableView } from "../../lib/useTableView";
import { useAppState } from "../../components/AppStateProvider";
import type { StudySectionKey } from "../../lib/studySections";

type SpacedRepetitionPageProps = {
  onSectionSelect?: (section: StudySectionKey) => void;
};

export const SpacedRepetitionPage = ({ onSectionSelect }: SpacedRepetitionPageProps) => {
  const {
    actions,
    flashcardNoteFiles,
    flashcardNoteFilesError,
    flashcardNoteFilesState,
    preview,
  } = useAppState();
  const {
    flashcards,
    spacedRepetition,
    vault,
    isFocusMode,
    setIsFocusMode,
    activeBoxFilter,
    statsView,
    flashcardFilterMode,
    setFlashcardFilterMode,
    focusLabel,
    prevShortcutTitle,
    nextShortcutTitle,
    vaultName,
    statsChartClass,
    statsChartStyle,
    maxBoxCount,
    filteredFlashcardEntries,
    flashcardsPanelCanGoBack,
    flashcardsPanelCanGoNext,
    handleFlashcardsPanelPageBack,
    handleFlashcardsPanelPageNext,
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
    spacedRepetitionHelpEnabled,
  } = useSrSessionViewModel();
  const isTableView = useTableView();
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isUserToolsOpen, setIsUserToolsOpen] = useState(false);
  const isFlashcardsPanelEmpty = filteredFlashcardEntries.length === 0;

  const noteFilesPanel = (
    <NoteFilesPanel
      className="sr-note-files-panel"
      files={flashcardNoteFiles}
      listState={flashcardNoteFilesState}
      listError={flashcardNoteFilesError}
      selectedFile={preview.selectedFile}
      vaultPath={vault.vaultPath}
      onSelectFile={actions.handleSelectFile}
    />
  );

  return (
    <div
      className={`spaced-repetition-layout ${isFocusMode ? "focus-mode" : ""} ${
        isTableView ? "table-view" : ""
      }`}
    >
      <div className="spaced-repetition-main">
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
            spacedRepetitionCorrectCount={
              spacedRepetition.spacedRepetitionCorrectCount
            }
            spacedRepetitionIncorrectCount={
              spacedRepetition.spacedRepetitionIncorrectCount
            }
            spacedRepetitionTotalQuestions={
              spacedRepetition.spacedRepetitionTotalQuestions
            }
            kpiItems={kpiItems}
            isCollapsible={isTableView}
            isCollapsed={isTableView && !isDiagramOpen}
            onToggleCollapse={() => setIsDiagramOpen((prev) => !prev)}
            controlsId="sr-diagram-body"
          />
        )}

        <section
          className={`panel sr-flashcards-panel ${
            isFlashcardsPanelEmpty ? "is-empty" : ""
          }`}
        >
          <SrHeader
            isFocusMode={isFocusMode}
            focusLabel={focusLabel}
            setIsFocusMode={setIsFocusMode}
            onSectionSelect={onSectionSelect}
          />
          {isFlashcardsPanelEmpty ? null : (
            <SrCardHost
              filteredFlashcardEntries={filteredFlashcardEntries}
              spacedRepetitionSubmissions={spacedRepetition.spacedRepetitionSubmissions}
              helpEnabled={spacedRepetitionHelpEnabled}
              vaultPath={vault.vaultPath}
              vaultPngAssets={vault.pngAssets}
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
              spacedRepetitionSelfGrades={
                spacedRepetition.spacedRepetitionSelfGrades
              }
              spacedRepetitionSelections={
                spacedRepetition.spacedRepetitionSelections
              }
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
              spacedRepetitionCanGoBack={flashcardsPanelCanGoBack}
              spacedRepetitionCanGoNext={flashcardsPanelCanGoNext}
              handleSpacedRepetitionPageBack={handleFlashcardsPanelPageBack}
              handleSpacedRepetitionPageNext={handleFlashcardsPanelPageNext}
              prevShortcutTitle={prevShortcutTitle}
              nextShortcutTitle={nextShortcutTitle}
            />
          )}
        </section>
      </div>

      {isFocusMode ? null : (
        <aside className="spaced-repetition-sidebar">
          {noteFilesPanel}
          <UserToolsPanel
            spacedRepetition={spacedRepetition}
            handleDeleteOpen={handleDeleteOpen}
            onStart={spacedRepetition.handleSpacedRepetitionActiveUserLoadCards}
            startDisabled={
              !spacedRepetition.spacedRepetitionActiveUser ||
              flashcards.isFlashcardScanning
            }
            isCollapsible={isTableView}
            isCollapsed={isTableView && !isUserToolsOpen}
            onToggleCollapse={() => setIsUserToolsOpen((prev) => !prev)}
            controlsId="sr-user-tools-body"
          />
          <SrToolsPanel
            spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
            setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
            spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
            setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
            flashcardFilterMode={flashcardFilterMode}
            setFlashcardFilterMode={setFlashcardFilterMode}
            statusLabel={spacedRepetition.spacedRepetitionStatusLabel}
            isCollapsible={isTableView}
            isCollapsed={isTableView && !isToolsOpen}
            onToggleCollapse={() => setIsToolsOpen((prev) => !prev)}
            controlsId="sr-tools-body"
          />
        </aside>
      )}

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
