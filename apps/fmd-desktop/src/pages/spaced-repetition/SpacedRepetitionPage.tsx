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
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrHeader.tsx: UI-Komponente.
 *
 * Exportiert:
 * - SpacedRepetitionPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnchoredPopup } from "../../components/AnchoredPopup";
import { SrCardHost } from "./components/SrCardHost";
import { SrHeader } from "./components/SrHeader";
import { SrStatsAndChart } from "./components/SrStatsAndChart";
import { SrToolsPanel } from "./components/SrToolsPanel";
import { NoteFilesPanel } from "../../components/NoteFilesPanel";
import { FileIcon, SettingsIcon } from "../../components/icons";
import { RightOverlayRail } from "../../components/RightOverlayRail";
import { useSrSessionViewModel } from "./hooks/useSrSessionViewModel";
import { useTableView } from "../../lib/useTableView";
import { useAppState } from "../../components/AppStateProvider";
import type { StudySectionKey } from "../../lib/studySections";
import { requestSettingsFocus } from "../../features/settings/settingsDeepLink";

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
    spacedRepetitionHelpEnabled,
    autoTimeEnabled,
    setAutoTimeEnabled,
    autoTimeStatusLabel,
    autoTimeProgressPercent,
    autoTimeIsRunning,
    autoTimeIsTimeUp,
  } = useSrSessionViewModel();
  const isTableView = useTableView();
  const isDesktopView = !isTableView;
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isNoteFilesPopupOpen, setIsNoteFilesPopupOpen] = useState(false);
  const noteFilesButtonRef = useRef<HTMLButtonElement | null>(null);
  const isFlashcardsPanelEmpty = filteredFlashcardEntries.length === 0;
  const autoTimeBarStyle = useMemo(
    () =>
      ({
        "--exam-time-progress": `${Math.max(
          0,
          Math.min(100, autoTimeProgressPercent),
        )}%`,
      }) as CSSProperties,
    [autoTimeProgressPercent],
  );

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

  useEffect(() => {
    if (isDesktopView && !isFocusMode) {
      return;
    }
    setIsNoteFilesPopupOpen(false);
  }, [isDesktopView, isFocusMode]);

  return (
    <div
      className={`spaced-repetition-layout ${
        isDesktopView ? "desktop-rail-layout" : ""
      } ${isFocusMode ? "focus-mode" : ""} ${
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
        {autoTimeEnabled ? (
          <div
            className={[
              "exam-time-bar",
              autoTimeIsRunning ? "is-running" : "is-idle",
              autoTimeIsTimeUp ? "is-time-up" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="exam-time-bar-header">
              <span className="label">{autoTimeStatusLabel}</span>
            </div>
            <div
              className="exam-time-bar-track"
              aria-hidden="true"
              style={autoTimeBarStyle}
            />
          </div>
        ) : null}

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

      {isDesktopView ? (
        null
      ) : (
        isFocusMode ? null : (
          <aside className="spaced-repetition-sidebar">
            {noteFilesPanel}
            <SrToolsPanel
              spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
              setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
              spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
              setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
              flashcardFilterMode={flashcardFilterMode}
              setFlashcardFilterMode={setFlashcardFilterMode}
              autoTimeEnabled={autoTimeEnabled}
              setAutoTimeEnabled={setAutoTimeEnabled}
              statusLabel={spacedRepetition.spacedRepetitionStatusLabel}
              isCollapsible={isTableView}
              isCollapsed={isTableView && !isToolsOpen}
              onToggleCollapse={() => setIsToolsOpen((prev) => !prev)}
              controlsId="sr-tools-body"
            />
          </aside>
        )
      )}
      <RightOverlayRail
        enabled={isDesktopView && !isFocusMode}
        pinned={isNoteFilesPopupOpen}
        ariaLabel="Spaced repetition quick actions"
        className="spaced-repetition-overlay-rail"
        actions={[
          {
            id: "tools",
            icon: <SettingsIcon />,
            label: "Spaced Repetition Tools",
            onClick: () => {
              setIsNoteFilesPopupOpen(false);
              requestSettingsFocus({
                pageId: "review-tools",
                subPageId: "spaced-repetition-tools",
                scrollSelector: ".spaced-repetition-panel",
                highlight: true,
              });
            },
          },
          {
            id: "note-files",
            icon: <FileIcon />,
            label: "Note Files",
            onClick: () => setIsNoteFilesPopupOpen((prev) => !prev),
            isActive: isNoteFilesPopupOpen,
            buttonRef: noteFilesButtonRef,
            ariaHaspopup: "dialog",
            ariaExpanded: isNoteFilesPopupOpen,
          },
        ]}
      />
      <AnchoredPopup
        isOpen={isDesktopView && !isFocusMode && isNoteFilesPopupOpen}
        onClose={() => setIsNoteFilesPopupOpen(false)}
        anchorRef={noteFilesButtonRef}
        closeLayerId="spaced-repetition-note-files"
        ariaLabel="Spaced repetition note files"
        className="note-files-popup"
      >
        {noteFilesPanel}
      </AnchoredPopup>
    </div>
  );
};
