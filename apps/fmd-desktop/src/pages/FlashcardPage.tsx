import { ClozeCard } from "../components/flashcards/ClozeCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { StatsPanel } from "../components/StatsPanel";
import { useAppState } from "../components/AppStateProvider";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";

const flashcardStatusLabel = "Not scanned yet";

export const FlashcardPage = () => {
  const { flashcards } = useAppState();
  const totalQuestions = flashcards.flashcards.length;

  return (
    <div className="flashcard-layout">
      <section className="panel flashcard-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcards</h2>
            {flashcards.flashcards.length === 0 ? (
              <p className="muted">{flashcardStatusLabel}</p>
            ) : null}
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
                      onInputChange={flashcards.handleClozeInputChange}
                      onTokenDrop={flashcards.handleClozeTokenDrop}
                      onTokenRemove={flashcards.handleClozeTokenRemove}
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
                      onSelect={flashcards.handleTrueFalseSelect}
                      onSubmit={flashcards.handleFlashcardSubmit}
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
                    onSelect={flashcards.handleFlashcardOptionSelect}
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
    </div>
  );
};
