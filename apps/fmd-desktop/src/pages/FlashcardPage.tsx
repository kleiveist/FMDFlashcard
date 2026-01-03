import { useCallback, useEffect, useState, type DragEvent } from "react";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { FreeTextCard } from "../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { StatsPanel } from "../components/StatsPanel";
import { useAppState } from "../components/AppStateProvider";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
} from "../features/flashcards/logic";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";

const flashcardStatusLabel = "Not scanned yet";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const FlashcardPage = () => {
  const { flashcards } = useAppState();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const totalQuestions = flashcards.flashcards.length;
  const focusLabel = isFocusMode ? "Exit focus mode" : "Enter focus mode";

  useEffect(() => {
    document.body.classList.toggle("focus-mode", isFocusMode);
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFocusMode(false);
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (flashcards.canGoBack) {
          flashcards.handleFlashcardPageBack();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (flashcards.canGoNext) {
          flashcards.handleFlashcardPageNext();
        }
        return;
      }

      if (event.key !== "Enter" && event.key !== "NumpadEnter") {
        return;
      }

      const visibleCards = flashcards.visibleFlashcards;
      if (visibleCards.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (let localIndex = 0; localIndex < visibleCards.length; localIndex += 1) {
          const cardIndex = flashcards.flashcardPageStart + localIndex;
          const card = visibleCards[localIndex];
          if (flashcards.flashcardSubmissions[cardIndex]) {
            continue;
          }
          if (card.kind === "multiple-choice") {
            if (flashcards.flashcardSelections[cardIndex]) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "true-false") {
            const selections = flashcards.flashcardTrueFalseSelections[cardIndex] ?? {};
            if (areTrueFalseItemsComplete(card, selections)) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "free-text") {
            continue;
          }
          const responses = flashcards.flashcardClozeResponses[cardIndex] ?? {};
          if (areClozeBlanksComplete(card, responses)) {
            return cardIndex;
          }
        }
        return null;
      };

      const resolvedIndex =
        activeCardIndex !== null &&
        activeCardIndex >= flashcards.flashcardPageStart &&
        activeCardIndex <
          flashcards.flashcardPageStart + flashcards.visibleFlashcards.length
          ? activeCardIndex
          : findFirstSubmittableIndex();

      if (resolvedIndex === null) {
        return;
      }

      const localIndex = resolvedIndex - flashcards.flashcardPageStart;
      const card = visibleCards[localIndex];
      if (!card || flashcards.flashcardSubmissions[resolvedIndex]) {
        return;
      }
      if (card.kind === "multiple-choice") {
        if (!flashcards.flashcardSelections[resolvedIndex]) {
          return;
        }
      } else if (card.kind === "true-false") {
        const selections = flashcards.flashcardTrueFalseSelections[resolvedIndex] ?? {};
        if (!areTrueFalseItemsComplete(card, selections)) {
          return;
        }
      } else if (card.kind === "free-text") {
        return;
      } else {
        const responses = flashcards.flashcardClozeResponses[resolvedIndex] ?? {};
        if (!areClozeBlanksComplete(card, responses)) {
          return;
        }
      }

      event.preventDefault();
      flashcards.handleFlashcardSubmit(resolvedIndex, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCardIndex,
    flashcards,
    isFocusMode,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, key: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardOptionSelect(cardIndex, key);
    },
    [flashcards],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleTrueFalseSelect(cardIndex, itemId, value);
    },
    [flashcards],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeInputChange(cardIndex, blankId, value);
    },
    [flashcards],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [flashcards],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeTokenRemove(cardIndex, blankId);
    },
    [flashcards],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardTextInputChange(cardIndex, value);
    },
    [flashcards],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardTextCheck(cardIndex);
    },
    [flashcards],
  );

  const handleSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardSelfGrade(cardIndex, grade);
    },
    [flashcards],
  );

  return (
    <div className={`flashcard-layout ${isFocusMode ? "focus-mode" : ""}`}>
      <section className="panel flashcard-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcards</h2>
            {flashcards.flashcards.length === 0 ? (
              <p className="muted">{flashcardStatusLabel}</p>
            ) : null}
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className={`focus-toggle ${isFocusMode ? "active" : ""}`}
              onClick={() => setIsFocusMode((prev) => !prev)}
              aria-pressed={isFocusMode}
              aria-label={focusLabel}
              title={focusLabel}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </button>
          </div>
        </div>
        <div className="panel-body">
          {flashcards.flashcards.length === 0 ? (
            <div className="empty-state">
              Select a note from DASHBOARD and start the flashcard scan
            </div>
          ) : (
            <div className="flashcard-list">
              {flashcards.visibleFlashcards.map((card, localIndex) => {
                const cardIndex = flashcards.flashcardPageStart + localIndex;
                const submitted = !!flashcards.flashcardSubmissions[cardIndex];

                if (card.kind === "cloze") {
                  return (
                    <ClozeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      responses={flashcards.flashcardClozeResponses[cardIndex] ?? {}}
                      onInputChange={handleClozeInputChange}
                      onTokenDrop={handleClozeTokenDrop}
                      onTokenRemove={handleClozeTokenRemove}
                      onTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "true-false") {
                  return (
                    <TrueFalseCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      selections={flashcards.flashcardTrueFalseSelections[cardIndex] ?? {}}
                      onSelect={handleTrueFalseSelect}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "free-text") {
                  return (
                    <FreeTextCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      response={flashcards.flashcardTextResponses[cardIndex] ?? ""}
                      revealed={flashcards.flashcardTextRevealed[cardIndex] ?? false}
                      selfGrade={flashcards.flashcardSelfGrades[cardIndex]}
                      onInputChange={handleTextInputChange}
                      onCheck={handleTextCheck}
                      onSelfGrade={handleSelfGrade}
                    />
                  );
                }

                return (
                  <MultipleChoiceCard
                    key={`flashcard-${cardIndex}`}
                    card={card}
                    cardIndex={cardIndex}
                    submitted={submitted}
                    selectedKey={flashcards.flashcardSelections[cardIndex] ?? ""}
                    onSelect={handleOptionSelect}
                    onSubmit={flashcards.handleFlashcardSubmit}
                  />
                );
              })}
            </div>
          )}
          <div className="flashcard-pagination">
            <button
              type="button"
              className="ghost small"
              onClick={flashcards.handleFlashcardPageBack}
              disabled={!flashcards.canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={flashcards.handleFlashcardPageNext}
              disabled={!flashcards.canGoNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isFocusMode ? null : (
        <div className="flashcard-sidebar">
          <section className="panel toolbar-panel">
            <div className="panel-header">
              <div>
                <h2>Flashcard Tools</h2>
                <p className="muted">Scan current notes for cards.</p>
              </div>
            </div>
            <div className="panel-body">
              <button
                type="button"
                className="primary"
                onClick={flashcards.handleFlashcardScan}
                disabled={flashcards.isFlashcardScanning}
              >
                {flashcards.isFlashcardScanning ? "Scanning..." : "Flashcard"}
              </button>
              <div className="flashcard-controls">
                <div className="toolbar-section">
                  <span className="label">ORDER</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardOrder === "in-order" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardOrder === "in-order"}
                      onClick={() => flashcards.setFlashcardOrder("in-order")}
                    >
                      In order
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardOrder === "random" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardOrder === "random"}
                      onClick={() => flashcards.setFlashcardOrder("random")}
                    >
                      Random
                    </button>
                  </div>
                </div>
                <div className="toolbar-section">
                  <span className="label">MODE</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardMode === "multiple-choice" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardMode === "multiple-choice"}
                      onClick={() => flashcards.setFlashcardMode("multiple-choice")}
                    >
                      Multiple Choice
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardMode === "yes-no" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardMode === "yes-no"}
                      onClick={() => flashcards.setFlashcardMode("yes-no")}
                    >
                      Yes/No
                    </button>
                  </div>
                </div>
                <div className="toolbar-section">
                  <span className="label">PAGE SIZE</span>
                  <div className="pill-grid">
                    {FLASHCARD_PAGE_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`pill pill-button ${
                          flashcards.flashcardPageSize === size ? "active" : ""
                        }`}
                        aria-pressed={flashcards.flashcardPageSize === size}
                        onClick={() => flashcards.setFlashcardPageSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="toolbar-section">
                  <span className="label">DEFAULT SCOPE</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardScope === "current" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardScope === "current"}
                      onClick={() => flashcards.setFlashcardScope("current")}
                    >
                      Current note
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardScope === "vault" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardScope === "vault"}
                      onClick={() => flashcards.setFlashcardScope("vault")}
                    >
                      Whole vault
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <StatsPanel
            correctCount={flashcards.correctCount}
            correctPercent={flashcards.correctPercent}
            incorrectCount={flashcards.incorrectCount}
            totalQuestions={totalQuestions}
          />
        </div>
      )}
    </div>
  );
};
