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
  const totalQuestions = flashcards.filteredFlashcardCount;
  const hasScannedCards = flashcards.flashcards.length > 0;
  const hasFilteredCards = flashcards.filteredFlashcardCount > 0;
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

      const visibleEntries = flashcards.visibleFlashcardEntries;
      if (visibleEntries.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (let localIndex = 0; localIndex < visibleEntries.length; localIndex += 1) {
          const entry = visibleEntries[localIndex];
          const cardIndex = entry.cardIndex;
          const card = entry.card;
          if (flashcards.flashcardSubmissions[cardIndex]) {
            continue;
          }
          if (card.kind === "multiple-choice") {
            if ((flashcards.flashcardSelections[cardIndex] ?? []).length > 0) {
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
        visibleEntries.some((entry) => entry.cardIndex === activeCardIndex)
          ? activeCardIndex
          : findFirstSubmittableIndex();

      if (resolvedIndex === null) {
        return;
      }

      const resolvedEntry = visibleEntries.find(
        (entry) => entry.cardIndex === resolvedIndex,
      );
      const card = resolvedEntry?.card;
      if (!card || flashcards.flashcardSubmissions[resolvedIndex]) {
        return;
      }
      if (card.kind === "multiple-choice") {
        if ((flashcards.flashcardSelections[resolvedIndex] ?? []).length === 0) {
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
    (cardIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardOptionSelect(cardIndex, keys);
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
            <h2>Flashcard</h2>
            {!hasScannedCards ? (
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
          {!hasScannedCards ? (
            <div className="empty-state">
              Select a note from DASHBOARD and start the flashcard scan
            </div>
          ) : !hasFilteredCards ? (
            <div className="empty-state">No cards match the selected mode.</div>
          ) : (
            <div className="flashcard-list">
              {flashcards.visibleFlashcardEntries.map((entry) => {
                const cardIndex = entry.cardIndex;
                const card = entry.card;
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
                    selectedKeys={flashcards.flashcardSelections[cardIndex] ?? []}
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
                  <select
                    className="text-input"
                    value={flashcards.flashcardMode}
                    onChange={(event) =>
                      flashcards.setFlashcardMode(
                        event.target.value as typeof flashcards.flashcardMode,
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
