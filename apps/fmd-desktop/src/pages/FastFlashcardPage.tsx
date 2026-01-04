import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { FreeTextCard } from "../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { useAppState } from "../components/AppStateProvider";
import { evaluateFlashcardResult } from "../features/flashcards/logic";
import { vaultBaseName } from "../lib/path";

const fastFlashcardStatusLabel = "Not scanned yet";
const FAST_FLASHCARD_DURATIONS = [3, 6, 12, 24, 48];

export const FastFlashcardPage = () => {
  const { flashcards, vault } = useAppState();
  const {
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
  } = flashcards;
  const [fastCardPosition, setFastCardPosition] = useState(0);
  const [isTimeModeEnabled, setIsTimeModeEnabled] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(6);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
  });
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const sessionCountedRef = useRef<Set<number>>(new Set());
  const prevTimeModeRef = useRef(false);

  const orderedEntries = flashcards.orderedFlashcardEntries;
  const currentEntry = orderedEntries[fastCardPosition] ?? null;
  const currentCardIndex = currentEntry?.cardIndex;
  const hasScannedCards = flashcards.flashcards.length > 0;
  const hasFilteredCards = orderedEntries.length > 0;
  const statsTotal = flashcards.filteredFlashcardCount;
  const statsCorrect = flashcards.correctCount;
  const statsIncorrect = flashcards.incorrectCount;
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";
  const timeModeActive = isTimeModeEnabled;
  const isCurrentSubmitted =
    currentCardIndex !== undefined &&
    Boolean(flashcardSubmissions[currentCardIndex]);
  const submissionLocked = !timeModeActive;
  const isTimerRunning =
    timeModeActive && currentCardIndex !== undefined && !isCurrentSubmitted;

  const currentResult = useMemo(() => {
    if (!currentEntry || !isCurrentSubmitted) {
      return "neutral";
    }
    return evaluateFlashcardResult(
      currentEntry.card,
      currentEntry.cardIndex,
      flashcards.flashcardSelections,
      flashcards.flashcardTrueFalseSelections,
      flashcards.flashcardClozeResponses,
      flashcards.flashcardSelfGrades,
    );
  }, [
    currentEntry,
    flashcards.flashcardClozeResponses,
    flashcards.flashcardSelections,
    flashcards.flashcardSelfGrades,
    flashcards.flashcardTrueFalseSelections,
    isCurrentSubmitted,
  ]);

  const canGoBack =
    timeModeActive &&
    isCurrentSubmitted &&
    currentResult === "correct" &&
    fastCardPosition > 0;
  const canGoNext =
    timeModeActive &&
    isCurrentSubmitted &&
    fastCardPosition < orderedEntries.length - 1;

  const correctPercent =
    statsTotal > 0 ? Math.round((statsCorrect / statsTotal) * 100) : 0;

  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${correctPercent}%`,
      }) as CSSProperties,
    [correctPercent],
  );

  const remainingSeconds = Math.max(0, timeRemaining ?? selectedDuration);
  const timeProgress = timeModeActive
    ? isTimerRunning
      ? Math.max(0, Math.min(1, remainingSeconds / selectedDuration))
      : 1
    : 0;

  const timeStatusLabel = !timeModeActive
    ? "Inactive"
    : isTimerRunning
      ? `Remaining: ${remainingSeconds}s`
      : "Ready";

  const timeProgressStyle = useMemo(
    () =>
      ({
        "--fast-time-progress": `${Math.round(timeProgress * 100)}%`,
      }) as CSSProperties,
    [timeProgress],
  );

  useEffect(() => {
    if (fastCardPosition < orderedEntries.length) {
      return;
    }
    setFastCardPosition(0);
  }, [fastCardPosition, orderedEntries.length]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [flashcards.flashcardMode, flashcards.flashcardOrder]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [flashcards.flashcards]);

  useEffect(() => {
    const wasEnabled = prevTimeModeRef.current;
    if (!wasEnabled && isTimeModeEnabled) {
      sessionStartRef.current = Date.now();
      sessionCountedRef.current = new Set(
        Object.keys(flashcardSubmissions)
          .map((key) => Number(key))
          .filter((index) => flashcardSubmissions[index]),
      );
      setSessionStats({ total: 0, correct: 0, incorrect: 0 });
      setSessionElapsedMs(0);
    }
    prevTimeModeRef.current = isTimeModeEnabled;
  }, [flashcardSubmissions, isTimeModeEnabled]);

  useEffect(() => {
    if (!timeModeActive) {
      return;
    }

    const counted = sessionCountedRef.current;
    const submittedIndices = Object.keys(flashcardSubmissions)
      .map((key) => Number(key))
      .filter((index) => flashcardSubmissions[index]);
    const newIndices = submittedIndices.filter((index) => !counted.has(index));

    if (newIndices.length === 0) {
      return;
    }

    newIndices.forEach((index) => counted.add(index));

    setSessionStats((prev) => {
      let nextTotal = prev.total;
      let nextCorrect = prev.correct;
      let nextIncorrect = prev.incorrect;

      newIndices.forEach((index) => {
        const card = flashcards.flashcards[index];
        if (!card) {
          return;
        }
        const result = evaluateFlashcardResult(
          card,
          index,
          flashcards.flashcardSelections,
          flashcards.flashcardTrueFalseSelections,
          flashcards.flashcardClozeResponses,
          flashcards.flashcardSelfGrades,
        );
        nextTotal += 1;
        if (result === "correct") {
          nextCorrect += 1;
        } else if (result === "incorrect") {
          nextIncorrect += 1;
        }
      });

      return {
        total: nextTotal,
        correct: nextCorrect,
        incorrect: nextIncorrect,
      };
    });
  }, [
    flashcardSubmissions,
    flashcards.flashcardClozeResponses,
    flashcards.flashcardSelections,
    flashcards.flashcardSelfGrades,
    flashcards.flashcardTrueFalseSelections,
    flashcards.flashcards,
    timeModeActive,
  ]);

  useEffect(() => {
    if (!timeModeActive || !isTimerRunning || !sessionStartRef.current) {
      return;
    }
    setSessionElapsedMs(Date.now() - sessionStartRef.current);
  }, [isTimerRunning, timeModeActive, timeRemaining]);

  const handleTimeout = useCallback(() => {
    if (!currentEntry) {
      return;
    }
    if (!flashcardSubmissions[currentEntry.cardIndex]) {
      if (currentEntry.card.kind === "free-text") {
        handleFlashcardSelfGrade(currentEntry.cardIndex, "incorrect");
      } else {
        handleFlashcardSubmit(currentEntry.cardIndex, true);
      }
    }
    setFastCardPosition((prev) =>
      Math.min(prev + 1, Math.max(orderedEntries.length - 1, 0)),
    );
  }, [
    currentEntry,
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
    orderedEntries.length,
  ]);

  useEffect(() => {
    if (
      !timeModeActive ||
      currentCardIndex === undefined ||
      isCurrentSubmitted
    ) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(selectedDuration);
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev === null ? selectedDuration : prev - 1;
        if (next <= 0) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleTimeout();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    currentCardIndex,
    handleTimeout,
    isCurrentSubmitted,
    selectedDuration,
    timeModeActive,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      flashcards.handleFlashcardOptionSelect(cardIndex, keys);
    },
    [flashcards],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      flashcards.handleTrueFalseSelect(cardIndex, itemId, value);
    },
    [flashcards],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
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
      flashcards.handleClozeTokenRemove(cardIndex, blankId);
    },
    [flashcards],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      flashcards.handleFlashcardTextInputChange(cardIndex, value);
    },
    [flashcards],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      flashcards.handleFlashcardTextCheck(cardIndex);
    },
    [flashcards],
  );

  const handleTimeToggle = useCallback(() => {
    setIsTimeModeEnabled((prev) => !prev);
  }, []);

  const handleFastSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean) => {
      if (!timeModeActive) {
        return;
      }
      handleFlashcardSubmit(cardIndex, canSubmit);
    },
    [handleFlashcardSubmit, timeModeActive],
  );

  const handleFastSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      if (!timeModeActive) {
        return;
      }
      handleFlashcardSelfGrade(cardIndex, grade);
    },
    [handleFlashcardSelfGrade, timeModeActive],
  );

  const sessionAnswered = sessionStats.correct + sessionStats.incorrect;
  const sessionAccuracy =
    sessionAnswered > 0
      ? Math.round((sessionStats.correct / sessionAnswered) * 100)
      : 0;
  const sessionScore = sessionStats.correct * 10 - sessionStats.incorrect * 5;
  const sessionMinutes = sessionElapsedMs / 60000;
  const sessionPace =
    sessionMinutes > 0 ? (sessionStats.total / sessionMinutes).toFixed(1) : "0.0";
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "ToDoList"),
    [vault.vaultPath],
  );

  return (
    <div className="fast-flashcard-layout">
      <section className="panel fast-stats-panel">
        <div className="panel-header">
          <div>
            <h2>Statistics Diagram</h2>
            <p className="muted">Progress trends over time</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="fast-stats-switch">
            <span className="label">View</span>
            <button
              type="button"
              className={`timer-start-button ${isTimeModeEnabled ? "active" : ""}`}
              onClick={handleTimeToggle}
              aria-pressed={isTimeModeEnabled}
            >
              <span className="timer-start-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="7.5" />
                  <path d="M12 7.5v4.4l2.8 1.8" />
                </svg>
              </span>
              <span className="timer-start-text">
                <span className="timer-start-meta">Time</span>
                <span className="timer-start-action">
                  {isTimeModeEnabled ? "Stop" : "Start"}
                </span>
              </span>
            </button>
          </div>
          <div className="fast-stats-blocks">
            <div className="fast-time-block">
              <div className="fast-block-header">
                <span className="label">Time</span>
                <span
                  className={`fast-time-status ${
                    timeModeActive ? "active" : "inactive"
                  }`}
                >
                  {timeStatusLabel}
                </span>
              </div>
              <div
                className="fast-time-meter"
                style={timeProgressStyle}
                aria-hidden="true"
              />
              <div className="fast-time-scale">
                <span>0s</span>
                <span>{selectedDuration}s</span>
              </div>
            </div>
            <div className="fast-stats-block">
              <div className="fast-stats-block-header">
                <span className="label">Statistics</span>
              </div>
              <div className="fast-stats-grid">
                <div className="fast-stats-labels">
                  <span className="stats-label">Correct</span>
                  <span className="stats-label">Incorrect</span>
                  <span className="stats-label">Total</span>
                </div>
                <div
                  className={statsChartClass}
                  style={statsChartStyle}
                  role="img"
                  aria-label={`Total ${statsTotal}`}
                >
                  <div className="stats-chart-label">
                    <span className="stats-chart-total">{statsTotal}</span>
                    <span className="stats-chart-caption">Total</span>
                  </div>
                </div>
                <div className="fast-stats-values">
                  <span className="stats-value">{statsCorrect}</span>
                  <span className="stats-value">{statsIncorrect}</span>
                  <span className="stats-value">{statsTotal}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="fast-session-section">
            <div className="fast-section-header">
              <div>
                <h3 className="fast-section-title">Session Momentum</h3>
                <p className="muted">Your progress for the current timer run.</p>
              </div>
            </div>
            <div className="fast-session-grid">
              <div className="fast-session-card">
                <span className="label">Cards</span>
                <span className="fast-session-value">{sessionStats.total}</span>
                <span className="fast-session-sub">Completed</span>
              </div>
              <div className="fast-session-card">
                <span className="label">Accuracy</span>
                <span className="fast-session-value">{sessionAccuracy}%</span>
                <span className="fast-session-sub">
                  {sessionStats.correct} correct / {sessionStats.incorrect} missed
                </span>
              </div>
              <div className="fast-session-card">
                <span className="label">Pace</span>
                <span className="fast-session-value">{sessionPace}</span>
                <span className="fast-session-sub">cards / min</span>
              </div>
              <div className="fast-session-card">
                <span className="label">Score</span>
                <span className="fast-session-value">{sessionScore}</span>
                <span className="fast-session-sub">+10 / -5</span>
              </div>
            </div>
          </div>
          <div className="fast-vault-block">
            <span className="label">AKTIVER VAULT</span>
            <div className="fast-vault-list">
              <span className="fast-vault-line">Vault: {vaultName}</span>
              <span className="fast-vault-line">
                Cards loaded: {flashcards.flashcards.length}
              </span>
              <span className="fast-vault-line">
                Filtered cards: {flashcards.filteredFlashcardCount}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel fast-tools-panel">
        <div className="panel-header">
          <div>
            <h2>Fast Flashcard Tools</h2>
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
              <span className="label">Duration</span>
              <div className="pill-grid">
                {FAST_FLASHCARD_DURATIONS.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    className={`pill pill-button ${
                      selectedDuration === duration ? "active" : ""
                    }`}
                    aria-pressed={selectedDuration === duration}
                    disabled={isTimeModeEnabled}
                    title={
                      isTimeModeEnabled ? "Stop timer to change duration" : undefined
                    }
                    onClick={() => setSelectedDuration(duration)}
                  >
                    {duration}s
                  </button>
                ))}
              </div>
            </div>
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

      <section className="panel fast-flashcard-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcard</h2>
            {!hasScannedCards ? (
              <p className="muted">{fastFlashcardStatusLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="panel-body">
          {!hasScannedCards ? (
            <div className="empty-state">
              Select a note from DASHBOARD and start the flashcard scan
            </div>
          ) : !hasFilteredCards ? (
            <div className="empty-state">No cards match the selected mode.</div>
          ) : currentEntry ? (
            <div className="flashcard-list">
              {currentEntry.card.kind === "cloze" ? (
                <ClozeCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  responses={
                    flashcards.flashcardClozeResponses[currentEntry.cardIndex] ?? {}
                  }
                  onInputChange={handleClozeInputChange}
                  onTokenDrop={handleClozeTokenDrop}
                  onTokenRemove={handleClozeTokenRemove}
                  onTokenDragStart={flashcards.handleClozeTokenDragStart}
                  onBlankDragOver={flashcards.handleClozeBlankDragOver}
                  onSubmit={handleFastSubmit}
                />
              ) : currentEntry.card.kind === "true-false" ? (
                <TrueFalseCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  selections={
                    flashcards.flashcardTrueFalseSelections[currentEntry.cardIndex] ?? {}
                  }
                  onSelect={handleTrueFalseSelect}
                  onSubmit={handleFastSubmit}
                />
              ) : currentEntry.card.kind === "free-text" ? (
                <FreeTextCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  response={
                    flashcards.flashcardTextResponses[currentEntry.cardIndex] ?? ""
                  }
                  revealed={
                    flashcards.flashcardTextRevealed[currentEntry.cardIndex] ?? false
                  }
                  selfGrade={flashcards.flashcardSelfGrades[currentEntry.cardIndex]}
                  onInputChange={handleTextInputChange}
                  onCheck={handleTextCheck}
                  onSelfGrade={handleFastSelfGrade}
                />
              ) : (
                <MultipleChoiceCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  selectedKeys={
                    flashcards.flashcardSelections[currentEntry.cardIndex] ?? []
                  }
                  onSelect={handleOptionSelect}
                  onSubmit={handleFastSubmit}
                />
              )}
            </div>
          ) : (
            <div className="empty-state">No cards available.</div>
          )}
          <div className="flashcard-pagination">
            <button
              type="button"
              className="ghost small"
              onClick={() => setFastCardPosition((prev) => Math.max(0, prev - 1))}
              disabled={!canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() =>
                setFastCardPosition((prev) =>
                  Math.min(prev + 1, Math.max(orderedEntries.length - 1, 0)),
                )
              }
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
