import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { CompositeCard } from "../components/flashcards/CompositeCard";
import { FreeTextCard } from "../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { useAppState } from "../components/AppStateProvider";
import { evaluateFlashcardResult } from "../features/flashcards/logic";
import { type FlashcardMode } from "../features/flashcards/useFlashcards";
import { vaultBaseName } from "../lib/path";

const fastFlashcardStatusLabel = "Not scanned yet";
const FAST_FLASHCARD_DURATIONS = [3, 6, 12, 24, 48];

type FastFlashcardResult = "correct" | "incorrect" | "timeout";

type FastFlashcardSessionSummary = {
  id: string;
  endedAt: string;
  score: number;
  correct: number;
  incorrect: number;
  timeout?: number;
  total: number;
  accuracy: number;
  pace: number;
  durationMs: number;
};

type FastFlashcardStorage = {
  sessions: FastFlashcardSessionSummary[];
};

type FastFlashcardSessionStats = {
  correct: number;
  incorrect: number;
  timeout: number;
};

const FAST_FLASHCARD_SCORE_BY_RESULT: Record<FastFlashcardResult, number> = {
  correct: 10,
  incorrect: -5,
  timeout: -5,
};

const FAST_FLASHCARD_DURATION_MULTIPLIER: Record<number, number> = {
  3: 1.5,
  6: 1.2,
  12: 1.0,
  24: 0.8,
  48: 0.5,
};

const getFastFlashcardMultiplier = (duration: number) =>
  FAST_FLASHCARD_DURATION_MULTIPLIER[duration] ?? 1;

const buildSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getSessionTimeValue = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatSessionTimestamp = (value: string) => {
  const timestamp = getSessionTimeValue(value);
  if (!timestamp) {
    return value;
  }
  return new Date(timestamp).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSessionPace = (pace: number) =>
  Number.isFinite(pace) ? pace.toFixed(1) : "0.0";

export const FastFlashcardPage = () => {
  const { flashcards: appFlashcards, fastFlashcards, settings, vault } =
    useAppState();
  const {
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
  } = fastFlashcards;
  const [fastCardPosition, setFastCardPosition] = useState(0);
  const [isTimeModeEnabled, setIsTimeModeEnabled] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(6);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState<FastFlashcardSessionStats>({
    correct: 0,
    incorrect: 0,
    timeout: 0,
  });
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<
    FastFlashcardSessionSummary[]
  >([]);
  const [sessionHistoryLoaded, setSessionHistoryLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const sessionCountedRef = useRef<Set<number>>(new Set());
  const sessionResultsRef = useRef<Map<number, FastFlashcardResult>>(new Map());
  const sessionTimeoutsRef = useRef<Set<number>>(new Set());
  const prevTimeModeRef = useRef(false);

  const orderedEntries = fastFlashcards.orderedFlashcardEntries;
  const currentEntry = orderedEntries[fastCardPosition] ?? null;
  const currentCardIndex = currentEntry?.cardIndex;
  const hasScannedCards = fastFlashcards.flashcards.length > 0;
  const hasFilteredCards = orderedEntries.length > 0;
  const statsCorrect = appFlashcards.correctCount;
  const statsIncorrect = appFlashcards.incorrectCount;
  const statsTotal = statsCorrect + statsIncorrect;
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
      fastFlashcards.flashcardSelections,
      fastFlashcards.flashcardTrueFalseSelections,
      fastFlashcards.flashcardClozeResponses,
      fastFlashcards.flashcardSelfGrades,
      fastFlashcards.flashcardCompositeStates,
    );
  }, [
    currentEntry,
    fastFlashcards.flashcardClozeResponses,
    fastFlashcards.flashcardCompositeStates,
    fastFlashcards.flashcardSelections,
    fastFlashcards.flashcardSelfGrades,
    fastFlashcards.flashcardTrueFalseSelections,
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

  const registerSessionResult = useCallback(
    (cardIndex: number, result: FastFlashcardResult) => {
      const results = sessionResultsRef.current;
      if (results.has(cardIndex)) {
        return;
      }
      results.set(cardIndex, result);
      setSessionStats((prev) => {
        if (result === "correct") {
          return { ...prev, correct: prev.correct + 1 };
        }
        if (result === "incorrect") {
          return { ...prev, incorrect: prev.incorrect + 1 };
        }
        return { ...prev, timeout: prev.timeout + 1 };
      });
    },
    [],
  );

  const resolveSessionResult = useCallback(
    (cardIndex: number): FastFlashcardResult | null => {
      if (sessionTimeoutsRef.current.has(cardIndex)) {
        sessionTimeoutsRef.current.delete(cardIndex);
        return "timeout";
      }
      const card = fastFlashcards.flashcards[cardIndex];
      if (!card) {
        return null;
      }
      const result = evaluateFlashcardResult(
        card,
        cardIndex,
        fastFlashcards.flashcardSelections,
        fastFlashcards.flashcardTrueFalseSelections,
        fastFlashcards.flashcardClozeResponses,
        fastFlashcards.flashcardSelfGrades,
        fastFlashcards.flashcardCompositeStates,
      );
      if (result === "correct" || result === "incorrect") {
        return result;
      }
      return null;
    },
    [
      fastFlashcards.flashcardClozeResponses,
      fastFlashcards.flashcardCompositeStates,
      fastFlashcards.flashcardSelections,
      fastFlashcards.flashcardSelfGrades,
      fastFlashcards.flashcardTrueFalseSelections,
      fastFlashcards.flashcards,
    ],
  );

  const recordSessionResults = useCallback(
    (indices: number[]) => {
      if (indices.length === 0) {
        return;
      }
      const counted = sessionCountedRef.current;
      indices.forEach((index) => counted.add(index));
      indices.forEach((index) => {
        const result = resolveSessionResult(index);
        if (result) {
          registerSessionResult(index, result);
        }
      });
    },
    [registerSessionResult, resolveSessionResult],
  );

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      try {
        const storage = await invoke<FastFlashcardStorage>(
          "load_fast_flashcard_data",
        );
        if (cancelled) {
          return;
        }
        const sessions = Array.isArray(storage?.sessions) ? storage.sessions : [];
        setSessionHistory(sessions);
      } catch (error) {
        console.warn("Failed to load fast flashcard sessions", error);
      } finally {
        if (!cancelled) {
          setSessionHistoryLoaded(true);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionHistoryLoaded) {
      return;
    }
    const storage: FastFlashcardStorage = {
      sessions: sessionHistory,
    };
    void invoke("save_fast_flashcard_data", { storage }).catch((error) => {
      console.warn("Failed to save fast flashcard sessions", error);
    });
  }, [sessionHistory, sessionHistoryLoaded]);

  useEffect(() => {
    if (fastCardPosition < orderedEntries.length) {
      return;
    }
    setFastCardPosition(0);
  }, [fastCardPosition, orderedEntries.length]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [fastFlashcards.flashcardMode, fastFlashcards.flashcardOrder]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [fastFlashcards.flashcards]);

  useEffect(() => {
    const wasEnabled = prevTimeModeRef.current;
    if (!wasEnabled && isTimeModeEnabled) {
      sessionStartRef.current = Date.now();
      const baseline = new Set(
        Object.keys(flashcardSubmissions)
          .map((key) => Number(key))
          .filter((index) => flashcardSubmissions[index]),
      );
      sessionCountedRef.current = baseline;
      sessionResultsRef.current = new Map();
      sessionTimeoutsRef.current = new Set();
      setSessionStats({ correct: 0, incorrect: 0, timeout: 0 });
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

    recordSessionResults(newIndices);
  }, [
    flashcardSubmissions,
    fastFlashcards.flashcardClozeResponses,
    fastFlashcards.flashcardCompositeStates,
    fastFlashcards.flashcardSelections,
    fastFlashcards.flashcardSelfGrades,
    fastFlashcards.flashcardTrueFalseSelections,
    fastFlashcards.flashcards,
    recordSessionResults,
    timeModeActive,
  ]);

  useEffect(() => {
    if (!timeModeActive || !sessionStartRef.current) {
      if (sessionTimerRef.current !== null) {
        window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      return;
    }

    const updateElapsed = () => {
      if (!sessionStartRef.current) {
        return;
      }
      setSessionElapsedMs(Date.now() - sessionStartRef.current);
    };

    updateElapsed();
    if (sessionTimerRef.current !== null) {
      window.clearInterval(sessionTimerRef.current);
    }
    sessionTimerRef.current = window.setInterval(updateElapsed, 1000);

    return () => {
      if (sessionTimerRef.current !== null) {
        window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [timeModeActive]);

  const handleTimeout = useCallback(() => {
    if (!currentEntry) {
      return;
    }
    if (!flashcardSubmissions[currentEntry.cardIndex]) {
      sessionTimeoutsRef.current.add(currentEntry.cardIndex);
      if (currentEntry.card.kind === "free-text") {
        handleFlashcardSelfGrade(currentEntry.cardIndex, "incorrect");
      } else {
        handleFlashcardSubmit(currentEntry.cardIndex, true);
      }
    }
  }, [
    currentEntry,
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
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
      fastFlashcards.handleFlashcardOptionSelect(cardIndex, keys);
    },
    [fastFlashcards],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      fastFlashcards.handleTrueFalseSelect(cardIndex, itemId, value);
    },
    [fastFlashcards],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      fastFlashcards.handleClozeInputChange(cardIndex, blankId, value);
    },
    [fastFlashcards],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      fastFlashcards.handleClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [fastFlashcards],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      fastFlashcards.handleClozeTokenRemove(cardIndex, blankId);
    },
    [fastFlashcards],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      fastFlashcards.handleFlashcardTextInputChange(cardIndex, value);
    },
    [fastFlashcards],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      fastFlashcards.handleFlashcardTextCheck(cardIndex);
    },
    [fastFlashcards],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      fastFlashcards.handleCompositeOptionSelect(cardIndex, partIndex, keys);
    },
    [fastFlashcards],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (
      cardIndex: number,
      partIndex: number,
      itemId: string,
      value: "wahr" | "falsch",
    ) => {
      fastFlashcards.handleCompositeTrueFalseSelect(
        cardIndex,
        partIndex,
        itemId,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      fastFlashcards.handleCompositeClozeInputChange(
        cardIndex,
        partIndex,
        blankId,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
        fastFlashcards.handleCompositeClozeTokenDrop(
          event,
          cardIndex,
          partIndex,
          blankId,
          validTokenIds,
          dragBlankIds,
        );
      },
      [fastFlashcards],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      fastFlashcards.handleCompositeClozeTokenRemove(
        cardIndex,
        partIndex,
        blankId,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      fastFlashcards.handleCompositeTextInputChange(
        cardIndex,
        partIndex,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      fastFlashcards.handleCompositeTextCheck(cardIndex, partIndex);
    },
    [fastFlashcards],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: "correct" | "incorrect") => {
      fastFlashcards.handleCompositeSelfGrade(cardIndex, partIndex, grade);
    },
    [fastFlashcards],
  );

  const finalizeSession = useCallback(() => {
    if (!sessionStartRef.current) {
      return;
    }
    const counted = sessionCountedRef.current;
    const submittedIndices = Object.keys(flashcardSubmissions)
      .map((key) => Number(key))
      .filter((index) => flashcardSubmissions[index])
      .filter((index) => !counted.has(index));
    recordSessionResults(submittedIndices);

    let correct = 0;
    let incorrect = 0;
    let timeout = 0;
    sessionResultsRef.current.forEach((result) => {
      if (result === "correct") {
        correct += 1;
      } else if (result === "incorrect") {
        incorrect += 1;
      } else {
        timeout += 1;
      }
    });

    const total = correct + incorrect + timeout;
    if (total === 0) {
      return;
    }
    const durationMs = Math.max(0, Date.now() - sessionStartRef.current);
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const pace =
      durationMs > 0 ? Number((total / (durationMs / 60000)).toFixed(1)) : 0;
    const baseScore =
      correct * FAST_FLASHCARD_SCORE_BY_RESULT.correct +
      incorrect * FAST_FLASHCARD_SCORE_BY_RESULT.incorrect +
      timeout * FAST_FLASHCARD_SCORE_BY_RESULT.timeout;
    const multiplier = getFastFlashcardMultiplier(selectedDuration);
    const score = Math.round(baseScore * multiplier);

    setSessionElapsedMs(durationMs);
    setSessionHistory((prev) => [
      ...prev,
      {
        id: buildSessionId(),
        endedAt: new Date().toISOString(),
        score,
        correct,
        incorrect,
        timeout,
        total,
        accuracy,
        pace,
        durationMs,
      },
    ]);
  }, [flashcardSubmissions, recordSessionResults, selectedDuration]);

  const handleTimeToggle = useCallback(() => {
    setIsTimeModeEnabled((prev) => {
      if (prev) {
        finalizeSession();
      }
      return !prev;
    });
  }, [finalizeSession]);

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

  const sessionCompleted =
    sessionStats.correct + sessionStats.incorrect + sessionStats.timeout;
  const sessionMissed = sessionStats.incorrect + sessionStats.timeout;
  const sessionAccuracy =
    sessionCompleted > 0
      ? Math.round((sessionStats.correct / sessionCompleted) * 100)
      : 0;
  const sessionBaseScore =
    sessionStats.correct * FAST_FLASHCARD_SCORE_BY_RESULT.correct +
    sessionStats.incorrect * FAST_FLASHCARD_SCORE_BY_RESULT.incorrect +
    sessionStats.timeout * FAST_FLASHCARD_SCORE_BY_RESULT.timeout;
  const sessionMultiplier = getFastFlashcardMultiplier(selectedDuration);
  const sessionScore = Math.round(sessionBaseScore * sessionMultiplier);
  const sessionMinutes = sessionElapsedMs / 60000;
  const sessionPace =
    sessionMinutes > 0 ? (sessionCompleted / sessionMinutes).toFixed(1) : "0.0";
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "ToDoList"),
    [vault.vaultPath],
  );
  const lastSessions = useMemo(() => {
    return [...sessionHistory]
      .sort((a, b) => getSessionTimeValue(b.endedAt) - getSessionTimeValue(a.endedAt))
      .slice(0, 10);
  }, [sessionHistory]);
  const topSessions = useMemo(() => {
    return [...sessionHistory]
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return getSessionTimeValue(b.endedAt) - getSessionTimeValue(a.endedAt);
      })
      .slice(0, 3);
  }, [sessionHistory]);

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
                <span className="fast-session-value">{sessionCompleted}</span>
                <span className="fast-session-sub">Completed</span>
              </div>
              <div className="fast-session-card">
                <span className="label">Accuracy</span>
                <span className="fast-session-value">{sessionAccuracy}%</span>
                <span className="fast-session-sub">
                  {sessionStats.correct} correct / {sessionMissed} missed
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
              <span className="fast-session-sub">
                +10 / -5 • x{sessionMultiplier.toFixed(1)}
              </span>
            </div>
            </div>
          </div>
          <div className="fast-vault-block">
            <span className="label">AKTIVER VAULT</span>
            <div className="fast-vault-row">
              <span>Vault: {vaultName}</span>
              <span className="fast-vault-sep" aria-hidden="true">
                •
              </span>
              <span>Cards loaded: {fastFlashcards.flashcards.length}</span>
              <span className="fast-vault-sep" aria-hidden="true">
                •
              </span>
              <span>Filtered cards: {fastFlashcards.filteredFlashcardCount}</span>
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
            onClick={fastFlashcards.handleFlashcardScan}
            disabled={fastFlashcards.isFlashcardScanning}
          >
            {fastFlashcards.isFlashcardScanning ? "Scanning..." : "Flashcard"}
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
                    settings.fastFlashcardOrder === "in-order" ? "active" : ""
                  }`}
                  aria-pressed={settings.fastFlashcardOrder === "in-order"}
                  onClick={() => settings.setFastFlashcardOrder("in-order")}
                >
                  In order
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    settings.fastFlashcardOrder === "random" ? "active" : ""
                  }`}
                  aria-pressed={settings.fastFlashcardOrder === "random"}
                  onClick={() => settings.setFastFlashcardOrder("random")}
                >
                  Random
                </button>
              </div>
            </div>
            <div className="toolbar-section">
              <span className="label">MODE</span>
                <select
                  className="text-input"
                  value={settings.fastFlashcardMode}
                  onChange={(event) =>
                    settings.setFastFlashcardMode(
                      event.target.value as FlashcardMode,
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
                    settings.fastFlashcardScope === "current" ? "active" : ""
                  }`}
                  aria-pressed={settings.fastFlashcardScope === "current"}
                  onClick={() => settings.setFastFlashcardScope("current")}
                >
                  Current note
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    settings.fastFlashcardScope === "vault" ? "active" : ""
                  }`}
                  aria-pressed={settings.fastFlashcardScope === "vault"}
                  onClick={() => settings.setFastFlashcardScope("vault")}
                >
                  Whole vault
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel fast-history-panel">
        <div className="panel-header">
          <div>
            <h2>Session History</h2>
            <p className="muted">Top scores and recent runs.</p>
          </div>
        </div>
        <div className="panel-body">
          {sessionHistory.length === 0 ? (
            <div className="empty-state">No sessions yet.</div>
          ) : (
            <div className="fast-history-sections">
              <div className="fast-session-section">
                <div>
                  <h3 className="fast-section-title">Top 3 Sessions</h3>
                  <p className="muted">Highest scores so far.</p>
                </div>
                <div className="fast-session-table">
                  <div className="fast-session-row header">
                    <span className="fast-session-cell timestamp">Date/Time</span>
                    <span className="fast-session-cell">Score</span>
                    <span className="fast-session-cell">Accuracy</span>
                    <span className="fast-session-cell">Pace</span>
                  </div>
                  {topSessions.map((session) => (
                    <div key={session.id} className="fast-session-row">
                      <span className="fast-session-cell timestamp">
                        {formatSessionTimestamp(session.endedAt)}
                      </span>
                      <span className="fast-session-cell">{session.score}</span>
                      <span className="fast-session-cell">{session.accuracy}%</span>
                      <span className="fast-session-cell">
                        {formatSessionPace(session.pace)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="fast-session-section">
                <div>
                  <h3 className="fast-section-title">Last 10 Sessions</h3>
                  <p className="muted">Most recent timer runs.</p>
                </div>
                <div className="fast-session-table">
                  <div className="fast-session-row header">
                    <span className="fast-session-cell timestamp">Date/Time</span>
                    <span className="fast-session-cell">Score</span>
                    <span className="fast-session-cell">Accuracy</span>
                    <span className="fast-session-cell">Pace</span>
                  </div>
                  {lastSessions.map((session) => (
                    <div key={session.id} className="fast-session-row">
                      <span className="fast-session-cell timestamp">
                        {formatSessionTimestamp(session.endedAt)}
                      </span>
                      <span className="fast-session-cell">{session.score}</span>
                      <span className="fast-session-cell">{session.accuracy}%</span>
                      <span className="fast-session-cell">
                        {formatSessionPace(session.pace)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
              {currentEntry.card.kind === "composite" ? (
                <CompositeCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  partStates={
                    fastFlashcards.flashcardCompositeStates[currentEntry.cardIndex] ?? []
                  }
                  onOptionSelect={handleCompositeOptionSelect}
                  onTrueFalseSelect={handleCompositeTrueFalseSelect}
                  onClozeInputChange={handleCompositeClozeInputChange}
                  onClozeTokenDrop={handleCompositeClozeTokenDrop}
                  onClozeTokenRemove={handleCompositeClozeTokenRemove}
                  onClozeTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
                  onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
                  onTextInputChange={handleCompositeTextInputChange}
                  onTextCheck={handleCompositeTextCheck}
                  onSelfGrade={handleCompositeSelfGrade}
                  onSubmit={handleFastSubmit}
                />
              ) : currentEntry.card.kind === "cloze" ? (
                <ClozeCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  responses={
                    fastFlashcards.flashcardClozeResponses[currentEntry.cardIndex] ?? {}
                  }
                  onInputChange={handleClozeInputChange}
                  onTokenDrop={handleClozeTokenDrop}
                  onTokenRemove={handleClozeTokenRemove}
                  onTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
                  onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
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
                    fastFlashcards.flashcardTrueFalseSelections[currentEntry.cardIndex] ?? {}
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
                    fastFlashcards.flashcardTextResponses[currentEntry.cardIndex] ?? ""
                  }
                  revealed={
                    fastFlashcards.flashcardTextRevealed[currentEntry.cardIndex] ?? false
                  }
                  selfGrade={fastFlashcards.flashcardSelfGrades[currentEntry.cardIndex]}
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
                    fastFlashcards.flashcardSelections[currentEntry.cardIndex] ?? []
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
