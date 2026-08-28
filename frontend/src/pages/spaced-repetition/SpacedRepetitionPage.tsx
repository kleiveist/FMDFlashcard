/**
 * @file frontend/src/pages/spaced-repetition/SpacedRepetitionPage.tsx
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
 * - frontend/src/pages/spaced-repetition/components/SrCardHost.tsx: UI-Komponente.
 * - frontend/src/pages/spaced-repetition/components/SrHeader.tsx: UI-Komponente.
 *
 * Exportiert:
 * - SpacedRepetitionPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnchoredPopup } from "../../components/AnchoredPopup";
import { FlashcardAreaMenuTrigger } from "../../components/flashcards/FlashcardAreaMenu";
import { SrCardHost } from "./components/SrCardHost";
import { SrHeader } from "./components/SrHeader";
import { SrStatsAndChart } from "./components/SrStatsAndChart";
import { SrToolsPanel } from "./components/SrToolsPanel";
import { NoteFilesPanel } from "../../components/NoteFilesPanel";
import { FileIcon, SettingsIcon } from "../../components/icons";
import { useSrSessionViewModel } from "./hooks/useSrSessionViewModel";
import { useTableView } from "../../lib/useTableView";
import { useAppState } from "../../components/AppStateProvider";
import type { StudySectionKey } from "../../lib/studySections";
import { requestSettingsFocus } from "../../features/settings/settingsDeepLink";
import { useFlashcardAreaToggle } from "../../features/flashcards/useFlashcardAreaToggle";
import { evaluateFlashcardResult } from "../../features/flashcards/logic";

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
    nextPreviewFlashcardEntry,
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

  const statsHeaderActions =
    isDesktopView && !isFocusMode ? (
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
          <span
            className="study-header-quick-action-icon"
            aria-hidden="true"
            style={{ width: 16, height: 16 }}
          >
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
              subPageId: "spaced-repetition-tools",
              scrollSelector: ".spaced-repetition-panel",
              highlight: true,
            });
          }}
          aria-label="Spaced Repetition Tools"
          title="Spaced Repetition Tools"
        >
          <span
            className="study-header-quick-action-icon"
            aria-hidden="true"
            style={{ width: 16, height: 16 }}
          >
            <SettingsIcon />
          </span>
        </button>
      </div>
    ) : null;
  const srAreaSourceByIndex = useMemo(
    () =>
      Object.fromEntries(
        filteredFlashcardEntries.map((entry) => [entry.cardIndex, entry.sourceMeta ?? null]),
      ),
    [filteredFlashcardEntries],
  );
  const srAreaToggle = useFlashcardAreaToggle({
    sourceByIndex: srAreaSourceByIndex,
    stageTaskAreaToggle: actions.stageTaskAreaToggle,
    getStagedTaskAreaToggle: actions.getStagedTaskAreaToggle,
    getTaskAreaToggleNotice: actions.getTaskAreaToggleNotice,
  });
  const renderSrResultHeaderAction = useCallback(
    (cardIndex: number, submitted: boolean) => {
      if (!submitted) {
        return null;
      }
      const card = spacedRepetition.spacedRepetitionFlashcards[cardIndex];
      const submissionResult = card
        ? evaluateFlashcardResult(
            card,
            cardIndex,
            spacedRepetition.spacedRepetitionSelections,
            spacedRepetition.spacedRepetitionTrueFalseSelections,
            spacedRepetition.spacedRepetitionClozeResponses,
            spacedRepetition.spacedRepetitionSelfGrades,
            spacedRepetition.spacedRepetitionCompositeStates,
          )
        : "pending";
      const toggleState = srAreaToggle.getToggleState(cardIndex);
      return (
        <FlashcardAreaMenuTrigger
          enabled={toggleState.enabled}
          pending={toggleState.pending}
          disabledReason={toggleState.disabledReason}
          error={toggleState.error}
          notice={toggleState.notice}
          locked={submissionResult === "incorrect"}
          onToggle={(nextEnabled) => srAreaToggle.toggleCardArea(cardIndex, nextEnabled)}
        />
      );
    },
    [
      spacedRepetition.spacedRepetitionClozeResponses,
      spacedRepetition.spacedRepetitionCompositeStates,
      spacedRepetition.spacedRepetitionFlashcards,
      spacedRepetition.spacedRepetitionSelections,
      spacedRepetition.spacedRepetitionSelfGrades,
      spacedRepetition.spacedRepetitionTrueFalseSelections,
      srAreaToggle,
    ],
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
            headerActions={statsHeaderActions}
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
              nextPreviewFlashcardEntry={nextPreviewFlashcardEntry}
              renderResultHeaderAction={renderSrResultHeaderAction}
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
      <AnchoredPopup
        isOpen={isDesktopView && !isFocusMode && isNoteFilesPopupOpen}
        onClose={() => setIsNoteFilesPopupOpen(false)}
        anchorRef={noteFilesButtonRef}
        closeLayerId="spaced-repetition-note-files"
        ariaLabel="Spaced repetition note files"
        mode="centered"
        showBackdrop
        className="note-files-popup"
      >
        {noteFilesPanel}
      </AnchoredPopup>
    </div>
  );
};
