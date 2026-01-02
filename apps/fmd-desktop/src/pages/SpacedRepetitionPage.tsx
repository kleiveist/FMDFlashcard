import { useMemo, useState, type CSSProperties } from "react";
import { buildLineChartPoints } from "../lib/chart";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { KpiGrid } from "../components/KpiGrid";
import { useAppState } from "../components/AppStateProvider";
import { vaultBaseName } from "../lib/path";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_CHART_DATA,
  SPACED_REPETITION_CHART_LABELS,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";

export const SpacedRepetitionPage = () => {
  const { flashcards, spacedRepetition, vault } = useAppState();
  const [statsView, setStatsView] = useState<
    "boxes" | "vault" | "completed"
  >("boxes");
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "—"),
    [vault.vaultPath],
  );

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

  return (
    <div className="spaced-repetition-layout">
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
                    onClick={() => setStatsView("boxes")}
                  >
                    Boxes
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${statsView === "vault" ? "active" : ""}`}
                    aria-pressed={statsView === "vault"}
                    onClick={() => setStatsView("vault")}
                  >
                    Active vault
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${
                      statsView === "completed" ? "active" : ""
                    }`}
                    aria-pressed={statsView === "completed"}
                    onClick={() => setStatsView("completed")}
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
                onClick={spacedRepetition.handleSpacedRepetitionDeleteUser}
                disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel sr-flashcards-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcards</h2>
            <p className="muted">{spacedRepetition.spacedRepetitionStatusLabel}</p>
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
                      onInputChange={spacedRepetition.handleSpacedRepetitionClozeInputChange}
                      onTokenDrop={spacedRepetition.handleSpacedRepetitionClozeTokenDrop}
                      onTokenRemove={spacedRepetition.handleSpacedRepetitionClozeTokenRemove}
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
                      onSelect={spacedRepetition.handleSpacedRepetitionTrueFalseSelect}
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
                    onSelect={spacedRepetition.handleSpacedRepetitionOptionSelect}
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
              Repetition order will prioritize due cards when scheduling is available.
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
    </div>
  );
};
