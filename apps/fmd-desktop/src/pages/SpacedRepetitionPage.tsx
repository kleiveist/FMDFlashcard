import { buildLineChartPoints } from "../lib/chart";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { KpiGrid } from "../components/KpiGrid";
import { useAppState } from "../components/AppStateProvider";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_CHART_DATA,
  SPACED_REPETITION_CHART_LABELS,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";

export const SpacedRepetitionPage = () => {
  const { flashcards, spacedRepetition } = useAppState();

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
                <line x1="0" y1="40" x2="100" y2="40" className="sr-chart-axis" />
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
