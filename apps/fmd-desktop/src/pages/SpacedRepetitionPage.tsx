import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { buildLineChartPoints } from "../lib/chart";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { KpiGrid } from "../components/KpiGrid";
import { useAppState } from "../components/AppStateProvider";
import { vaultBaseName } from "../lib/path";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
} from "../features/flashcards/logic";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_CHART_DATA,
  SPACED_REPETITION_CHART_LABELS,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";

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

export const SpacedRepetitionPage = () => {
  const { flashcards, spacedRepetition, vault } = useAppState();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const statsView = spacedRepetition.spacedRepetitionStatsView;
  const focusLabel = isFocusMode ? "Exit focus mode" : "Enter focus mode";
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "—"),
    [vault.vaultPath],
  );
  const selectedUser = useMemo(
    () =>
      spacedRepetition.spacedRepetitionUsers.find(
        (user) => user.id === spacedRepetition.spacedRepetitionSelectedUserId,
      ),
    [
      spacedRepetition.spacedRepetitionSelectedUserId,
      spacedRepetition.spacedRepetitionUsers,
    ],
  );
  const deleteTargetName = selectedUser?.name ?? "";
  const deleteInputValue = deleteConfirmInput.trim();
  const canConfirmDelete =
    Boolean(deleteTargetName) && deleteInputValue === deleteTargetName;

  const statsTotal =
    spacedRepetition.spacedRepetitionCorrectCount +
    spacedRepetition.spacedRepetitionIncorrectCount;
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";
  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${spacedRepetition.spacedRepetitionCorrectPercent}%`,
      }) as CSSProperties,
    [spacedRepetition.spacedRepetitionCorrectPercent],
  );
  const maxBoxCount = Math.max(...spacedRepetition.spacedRepetitionBoxCounts, 0);

  const kpiItems = [
    { label: "Correct", value: spacedRepetition.spacedRepetitionCorrectCount },
    { label: "Incorrect", value: spacedRepetition.spacedRepetitionIncorrectCount },
    { label: "Total", value: spacedRepetition.spacedRepetitionTotalQuestions },
    {
      label: "Due now",
      value: spacedRepetition.spacedRepetitionProgressStats.dueNow,
    },
    {
      label: "Due today",
      value: spacedRepetition.spacedRepetitionProgressStats.dueToday,
    },
    {
      label: "In queue",
      value: spacedRepetition.spacedRepetitionProgressStats.inQueue,
    },
    {
      label: "Completed today",
      value: spacedRepetition.spacedRepetitionProgressStats.completedToday,
    },
  ];

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return;
    }
    if (!selectedUser) {
      setIsDeleteDialogOpen(false);
      setDeleteConfirmInput("");
    }
  }, [isDeleteDialogOpen, selectedUser]);

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
        if (spacedRepetition.spacedRepetitionCanGoBack) {
          spacedRepetition.handleSpacedRepetitionPageBack();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (spacedRepetition.spacedRepetitionCanGoNext) {
          spacedRepetition.handleSpacedRepetitionPageNext();
        }
        return;
      }

      if (event.key !== "Enter" && event.key !== "NumpadEnter") {
        return;
      }

      const visibleCards = spacedRepetition.spacedRepetitionVisibleFlashcards;
      if (visibleCards.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (let localIndex = 0; localIndex < visibleCards.length; localIndex += 1) {
          const cardIndex =
            spacedRepetition.spacedRepetitionPageStart + localIndex;
          const card = visibleCards[localIndex];
          if (spacedRepetition.spacedRepetitionSubmissions[cardIndex]) {
            continue;
          }
          if (card.kind === "multiple-choice") {
            if (spacedRepetition.spacedRepetitionSelections[cardIndex]) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "true-false") {
            const selections =
              spacedRepetition.spacedRepetitionTrueFalseSelections[cardIndex] ?? {};
            if (areTrueFalseItemsComplete(card, selections)) {
              return cardIndex;
            }
            continue;
          }
          const responses =
            spacedRepetition.spacedRepetitionClozeResponses[cardIndex] ?? {};
          if (areClozeBlanksComplete(card, responses)) {
            return cardIndex;
          }
        }
        return null;
      };

      const resolvedIndex =
        activeCardIndex !== null &&
        activeCardIndex >= spacedRepetition.spacedRepetitionPageStart &&
        activeCardIndex <
          spacedRepetition.spacedRepetitionPageStart +
            spacedRepetition.spacedRepetitionVisibleFlashcards.length
          ? activeCardIndex
          : findFirstSubmittableIndex();

      if (resolvedIndex === null) {
        return;
      }

      const localIndex = resolvedIndex - spacedRepetition.spacedRepetitionPageStart;
      const card = visibleCards[localIndex];
      if (!card || spacedRepetition.spacedRepetitionSubmissions[resolvedIndex]) {
        return;
      }
      if (card.kind === "multiple-choice") {
        if (!spacedRepetition.spacedRepetitionSelections[resolvedIndex]) {
          return;
        }
      } else if (card.kind === "true-false") {
        const selections =
          spacedRepetition.spacedRepetitionTrueFalseSelections[resolvedIndex] ?? {};
        if (!areTrueFalseItemsComplete(card, selections)) {
          return;
        }
      } else {
        const responses =
          spacedRepetition.spacedRepetitionClozeResponses[resolvedIndex] ?? {};
        if (!areClozeBlanksComplete(card, responses)) {
          return;
        }
      }

      event.preventDefault();
      spacedRepetition.handleSpacedRepetitionSubmit(resolvedIndex, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCardIndex,
    isFocusMode,
    spacedRepetition,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, key: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionOptionSelect(cardIndex, key);
    },
    [spacedRepetition],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionTrueFalseSelect(
        cardIndex,
        itemId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeInputChange(
        cardIndex,
        blankId,
        value,
      );
    },
    [spacedRepetition],
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
      spacedRepetition.handleSpacedRepetitionClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [spacedRepetition],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeTokenRemove(cardIndex, blankId);
    },
    [spacedRepetition],
  );

  const handleDeleteOpen = useCallback(() => {
    if (!selectedUser) {
      return;
    }
    setDeleteConfirmInput("");
    setIsDeleteDialogOpen(true);
  }, [selectedUser]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!canConfirmDelete) {
      return;
    }
    spacedRepetition.handleSpacedRepetitionDeleteUser();
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, [canConfirmDelete, spacedRepetition]);

  return (
    <div className={`spaced-repetition-layout ${isFocusMode ? "focus-mode" : ""}`}>
      {isFocusMode ? null : (
        <section className="panel sr-diagram-panel">
        <div className="panel-header">
          <div>
            <h2>Statistics Diagram</h2>
            <p className="muted">Progress trends over time.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="sr-stats-top">
            <div className="sr-stats-left">
              <div className="sr-stats-switch">
                <span className="label">View</span>
                <div className="pill-grid">
                  <button
                    type="button"
                    className={`pill pill-button ${statsView === "boxes" ? "active" : ""}`}
                    aria-pressed={statsView === "boxes"}
                    onClick={() => spacedRepetition.setSpacedRepetitionStatsView("boxes")}
                  >
                    Boxes
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${statsView === "vault" ? "active" : ""}`}
                    aria-pressed={statsView === "vault"}
                    onClick={() => spacedRepetition.setSpacedRepetitionStatsView("vault")}
                  >
                    Active vault
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${
                      statsView === "completed" ? "active" : ""
                    }`}
                    aria-pressed={statsView === "completed"}
                    onClick={() =>
                      spacedRepetition.setSpacedRepetitionStatsView("completed")
                    }
                  >
                    Completed per day
                  </button>
                </div>
              </div>
              {statsView === "boxes" ? (
                <div className="sr-box-chart">
                  <div className="sr-box-chart-header">
                    <span className="label">BOXES</span>
                  </div>
                  <div className="sr-box-chart-grid">
                    {spacedRepetition.spacedRepetitionBoxCounts.map((count, index) => {
                      const heightPercent =
                        maxBoxCount > 0
                          ? Math.round((count / maxBoxCount) * 100)
                          : 0;
                      const barStyle = {
                        "--bar-height":
                          count > 0 ? `${Math.max(heightPercent, 6)}%` : "0%",
                      } as CSSProperties;

                      return (
                        <div key={`box-${index + 1}`} className="sr-box-column">
                          <span className="sr-box-count">{count}</span>
                          <div className="sr-box-bar" style={barStyle}>
                            <div className="sr-box-bar-fill" />
                          </div>
                          <span className="sr-box-label">{index + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : statsView === "vault" ? (
                <div className="sr-vault-card">
                  <div className="sr-vault-row">
                    <span className="label">Vault</span>
                    <span className="value">{vaultName}</span>
                  </div>
                  <div className="sr-vault-row">
                    <span className="label">Notes</span>
                    <span className="value">{vault.files.length}</span>
                  </div>
                  <div className="sr-vault-row">
                    <span className="label">Cards loaded</span>
                    <span className="value">
                      {spacedRepetition.spacedRepetitionFlashcards.length}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="chart-card">
                  <div className="chart-header">
                    <span className="label">Completed per day</span>
                    <span className="chart-meta">Last 7 days</span>
                  </div>
                  <div className="chart-canvas">
                    <svg
                      className="sr-chart"
                      viewBox="0 0 100 40"
                      role="img"
                      aria-label="Completed per day"
                    >
                      <line
                        x1="0"
                        y1="40"
                        x2="100"
                        y2="40"
                        className="sr-chart-axis"
                      />
                      <polyline
                        className="sr-chart-line"
                        points={buildLineChartPoints(SPACED_REPETITION_CHART_DATA)}
                      />
                    </svg>
                  </div>
                  <div className="chart-axis">
                    {SPACED_REPETITION_CHART_LABELS.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="sr-stats-right">
              <span className="label">Statistics</span>
              <div className="stats-summary">
                <div className="stats-counters">
                  <div className="stats-counter">
                    <span className="stats-label">Correct</span>
                    <span className="stats-value">
                      {spacedRepetition.spacedRepetitionCorrectCount}
                    </span>
                  </div>
                  <div className="stats-counter">
                    <span className="stats-label">Incorrect</span>
                    <span className="stats-value">
                      {spacedRepetition.spacedRepetitionIncorrectCount}
                    </span>
                  </div>
                  <div className="stats-counter">
                    <span className="stats-label">Total</span>
                    <span className="stats-value">
                      {spacedRepetition.spacedRepetitionTotalQuestions}
                    </span>
                  </div>
                </div>
                <div
                  className={statsChartClass}
                  style={statsChartStyle}
                  role="img"
                  aria-label={`Correct ${spacedRepetition.spacedRepetitionCorrectCount}, Incorrect ${spacedRepetition.spacedRepetitionIncorrectCount}, Total ${spacedRepetition.spacedRepetitionTotalQuestions}`}
                >
                  <div className="stats-chart-label">
                    <span className="stats-chart-total">
                      {spacedRepetition.spacedRepetitionTotalQuestions}
                    </span>
                    <span className="stats-chart-caption">Total</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {isFocusMode ? null : (
        <section className="panel sr-user-panel">
        <div className="panel-header">
          <div>
            <h2>User Tools</h2>
          </div>
        </div>
        <div className="panel-body">
          <div className="setting-row">
            <span className="label">Active user</span>
            <button
              type="button"
              className="value active-user-button"
              onClick={spacedRepetition.handleSpacedRepetitionActiveUserLoadCards}
              disabled={
                !spacedRepetition.spacedRepetitionActiveUser ||
                flashcards.isFlashcardScanning
              }
              aria-label="Load flashcards for active user"
            >
              {spacedRepetition.spacedRepetitionActiveUser ?? "—"}
            </button>
          </div>
          <div className="setting-row">
            <span className="label">User list</span>
            <select
              className="text-input"
              value={spacedRepetition.spacedRepetitionSelectedUserId}
              onChange={(event) =>
                spacedRepetition.setSpacedRepetitionSelectedUserId(event.target.value)
              }
              aria-label="Select user"
            >
              <option value="">Select user</option>
              {spacedRepetition.spacedRepetitionUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <span className="label">New user</span>
            <div className="setting-inline">
              <input
                type="text"
                className="text-input"
                value={spacedRepetition.spacedRepetitionNewUserName}
                onChange={(event) => {
                  spacedRepetition.setSpacedRepetitionNewUserName(event.target.value);
                  if (spacedRepetition.spacedRepetitionUserError) {
                    spacedRepetition.setSpacedRepetitionUserError("");
                  }
                }}
                placeholder="User name"
                aria-label="New user name"
              />
              <button
                type="button"
                className="ghost small"
                onClick={spacedRepetition.handleSpacedRepetitionCreateUser}
              >
                Create
              </button>
            </div>
            {spacedRepetition.spacedRepetitionUserError ? (
              <span className="helper-text error-text">
                {spacedRepetition.spacedRepetitionUserError}
              </span>
            ) : null}
          </div>
          <div className="setting-row">
            <span className="label">Actions</span>
            <div className="setting-actions">
              <button
                type="button"
                className="ghost small"
                onClick={spacedRepetition.handleSpacedRepetitionLoadUser}
                disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
              >
                Load
              </button>
              <button
                type="button"
                className="ghost small"
                onClick={handleDeleteOpen}
                disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      <section className="panel sr-flashcards-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcards</h2>
            <p className="muted">{spacedRepetition.spacedRepetitionStatusLabel}</p>
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
          {spacedRepetition.spacedRepetitionFlashcards.length === 0 ? (
            <div className="empty-state">{spacedRepetition.spacedRepetitionEmptyState}</div>
          ) : (
            <div className="flashcard-list">
              {spacedRepetition.spacedRepetitionVisibleFlashcards.map((card, localIndex) => {
                const cardIndex = spacedRepetition.spacedRepetitionPageStart + localIndex;
                const submitted = !!spacedRepetition.spacedRepetitionSubmissions[cardIndex];

                if (card.kind === "cloze") {
                  return (
                    <ClozeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      responses={spacedRepetition.spacedRepetitionClozeResponses[cardIndex] ?? {}}
                      onInputChange={handleClozeInputChange}
                      onTokenDrop={handleClozeTokenDrop}
                      onTokenRemove={handleClozeTokenRemove}
                      onTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onSubmit={spacedRepetition.handleSpacedRepetitionSubmit}
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
                      selections={
                        spacedRepetition.spacedRepetitionTrueFalseSelections[cardIndex] ?? {}
                      }
                      onSelect={handleTrueFalseSelect}
                      onSubmit={spacedRepetition.handleSpacedRepetitionSubmit}
                    />
                  );
                }

                return (
                  <MultipleChoiceCard
                    key={`flashcard-${cardIndex}`}
                    card={card}
                    cardIndex={cardIndex}
                    submitted={submitted}
                    selectedKey={spacedRepetition.spacedRepetitionSelections[cardIndex] ?? ""}
                    onSelect={handleOptionSelect}
                    onSubmit={spacedRepetition.handleSpacedRepetitionSubmit}
                  />
                );
              })}
            </div>
          )}
          <div className="flashcard-pagination">
            <button
              type="button"
              className="ghost small"
              onClick={spacedRepetition.handleSpacedRepetitionPageBack}
              disabled={!spacedRepetition.spacedRepetitionCanGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={spacedRepetition.handleSpacedRepetitionPageNext}
              disabled={!spacedRepetition.spacedRepetitionCanGoNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isFocusMode ? null : (
        <section className="panel sr-tools-panel">
          <div className="panel-header">
            <div>
              <h2>Spaced Repetition Tools</h2>
            </div>
          </div>
          <div className="panel-body">
            <div className="setting-row">
              <span className="label">Boxes</span>
              <div className="pill-grid">
                {SPACED_REPETITION_BOXES.map((box) => (
                  <button
                    key={box}
                    type="button"
                    className={`pill pill-button ${
                      spacedRepetition.spacedRepetitionBoxes === box ? "active" : ""
                    }`}
                    aria-pressed={spacedRepetition.spacedRepetitionBoxes === box}
                    onClick={() => spacedRepetition.setSpacedRepetitionBoxes(box)}
                  >
                    {box} Boxes
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-row">
              <span className="label">Default order</span>
              <div className="pill-grid">
                <button
                  type="button"
                  className={`pill pill-button ${
                    spacedRepetition.spacedRepetitionOrder === "in-order" ? "active" : ""
                  }`}
                  aria-pressed={spacedRepetition.spacedRepetitionOrder === "in-order"}
                  onClick={() => spacedRepetition.setSpacedRepetitionOrder("in-order")}
                >
                  In order
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    spacedRepetition.spacedRepetitionOrder === "random" ? "active" : ""
                  }`}
                  aria-pressed={spacedRepetition.spacedRepetitionOrder === "random"}
                  onClick={() => spacedRepetition.setSpacedRepetitionOrder("random")}
                >
                  Random
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    spacedRepetition.spacedRepetitionOrder === "repetition" ? "active" : ""
                  }`}
                  aria-pressed={spacedRepetition.spacedRepetitionOrder === "repetition"}
                  onClick={() => spacedRepetition.setSpacedRepetitionOrder("repetition")}
                >
                  Repetition
                </button>
              </div>
              <span className="helper-text">
                In order keeps scan order. Random shuffles on load. Repetition
                prioritizes lower boxes and skips the last box.
              </span>
            </div>
            <div className="setting-row">
              <span className="label">Page size</span>
              <div className="pill-grid">
                {SPACED_REPETITION_PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`pill pill-button ${
                      spacedRepetition.spacedRepetitionPageSize === size ? "active" : ""
                    }`}
                    aria-pressed={spacedRepetition.spacedRepetitionPageSize === size}
                    onClick={() => spacedRepetition.setSpacedRepetitionPageSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isFocusMode ? null : (
        <section className="panel stats-panel sr-stats-panel">
          <div className="panel-header">
            <div>
              <h2>Statistics</h2>
            </div>
          </div>
          <div className="panel-body">
            <KpiGrid items={kpiItems} />
          </div>
        </section>
      )}
      {isDeleteDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
          >
            <h3 id="delete-user-title">Delete user</h3>
            <p className="muted">
              This permanently deletes the user and all spaced repetition progress.
            </p>
            <div className="modal-body">
              <span className="label">Type {deleteTargetName} to confirm</span>
              <input
                type="text"
                className="text-input"
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
                aria-label="Type the username to confirm deletion"
              />
              <span className="helper-text">
                Match is case-sensitive. Leading/trailing spaces are ignored.
              </span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleDeleteConfirm}
                disabled={!canConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
