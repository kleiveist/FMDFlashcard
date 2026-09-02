// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppState } from "../../../components/AppStateProvider";
import { useSrSessionViewModel } from "./useSrSessionViewModel";

vi.mock("../../../components/AppStateProvider", () => ({
  useAppState: vi.fn(),
}));

const mockUseAppState = vi.mocked(useAppState);

type HookState = ReturnType<typeof useSrSessionViewModel> | null;

const Probe = ({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useSrSessionViewModel>) => void;
}) => {
  onValue(useSrSessionViewModel());
  return null;
};

const renderHook = (onValue: (value: ReturnType<typeof useSrSessionViewModel>) => void) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const rerender = () => {
    act(() => {
      root.render(createElement(Probe, { onValue }));
    });
  };

  rerender();

  return {
    rerender,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const baseDurationMap = {
  qa: 1,
  tf: 1,
  m1: 1,
  m2: 1,
  cl: 1,
  cd: 1,
  cld: 1,
};

const createMockAppState = ({
  cards,
  submissions,
  autoTimeEnabled,
  onSubmit,
  onSelfGrade,
}: {
  cards: any[];
  submissions: Record<number, boolean>;
  autoTimeEnabled: boolean;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
  onSelfGrade: (cardIndex: number, grade: "correct" | "incorrect") => void;
}) => {
  const cardIds = cards.map((_, index) => `card-${index}`);
  const cardSourceById = Object.fromEntries(
    cardIds.map((cardId) => [
      cardId,
      {
        sourcePath: `/vault/card-${cardId}.md`,
        sourceRange: null,
        cardWrapper: true,
      },
    ]),
  );

  return {
    flashcards: {
      handleClozeTokenDragStart: vi.fn(),
      handleClozeBlankDragOver: vi.fn(),
    },
    settings: {
      spacedRepetitionHelpEnabled: true,
      flashcardMode: "all",
      setFlashcardMode: vi.fn(),
      spacedRepetitionAutoTimeEnabled: autoTimeEnabled,
      setSpacedRepetitionAutoTimeEnabled: vi.fn(),
      examTaskTypeDefaultTimeSeconds: baseDurationMap,
      keyboardShortcuts: { bindings: {} },
    },
    spacedRepetition: {
      spacedRepetitionStatsView: "boxes",
      spacedRepetitionUsers: [],
      spacedRepetitionSelectedUserId: "",
      spacedRepetitionCorrectCount: 0,
      spacedRepetitionIncorrectCount: 0,
      spacedRepetitionCorrectPercent: 0,
      spacedRepetitionBoxCounts: [0, 0, 0, 0, 0],
      spacedRepetitionFlashcards: cards,
      spacedRepetitionCardIds: cardIds,
      spacedRepetitionCardSourceById: cardSourceById,
      spacedRepetitionCardStates: {},
      spacedRepetitionBoxes: 5,
      spacedRepetitionPageSize: 5,
      spacedRepetitionPage: 0,
      setSpacedRepetitionPage: vi.fn(),
      spacedRepetitionSubmissions: submissions,
      spacedRepetitionCompositeStates: {},
      spacedRepetitionSelections: {},
      spacedRepetitionTrueFalseSelections: {},
      spacedRepetitionClozeResponses: {},
      spacedRepetitionTextResponses: {},
      spacedRepetitionTextRevealed: {},
      spacedRepetitionSelfGrades: {},
      spacedRepetitionProgressStats: {
        dueNow: 0,
        dueToday: 0,
        inQueue: 0,
        completedToday: 0,
      },
      handleSpacedRepetitionSubmit: onSubmit,
      handleSpacedRepetitionSelfGrade: onSelfGrade,
      handleSpacedRepetitionOptionSelect: vi.fn(),
      handleSpacedRepetitionTrueFalseSelect: vi.fn(),
      handleSpacedRepetitionClozeInputChange: vi.fn(),
      handleSpacedRepetitionClozeTokenDrop: vi.fn(),
      handleSpacedRepetitionClozeTokenRemove: vi.fn(),
      handleSpacedRepetitionTextInputChange: vi.fn(),
      handleSpacedRepetitionTextCheck: vi.fn(),
      handleSpacedRepetitionCompositeOptionSelect: vi.fn(),
      handleSpacedRepetitionCompositeTrueFalseSelect: vi.fn(),
      handleSpacedRepetitionCompositeClozeInputChange: vi.fn(),
      handleSpacedRepetitionCompositeClozeTokenDrop: vi.fn(),
      handleSpacedRepetitionCompositeClozeTokenRemove: vi.fn(),
      handleSpacedRepetitionCompositeTextInputChange: vi.fn(),
      handleSpacedRepetitionCompositeTextCheck: vi.fn(),
      handleSpacedRepetitionCompositeSelfGrade: vi.fn(),
      handleSpacedRepetitionDeleteUser: vi.fn(),
      handleSpacedRepetitionActiveUserLoadCards: vi.fn(),
      setSpacedRepetitionBoxes: vi.fn(),
      setSpacedRepetitionPageSize: vi.fn(),
    },
    vault: {
      vaultPath: null,
    },
  } as unknown as ReturnType<typeof useAppState>;
};

describe("useSrSessionViewModel auto time", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("times out free-text cards as incorrect self-grade", () => {
    const onSubmit = vi.fn();
    const onSelfGrade = vi.fn();
    const cards = [
      {
        kind: "free-text",
        front: "Q",
        back: "A",
      },
    ];

    mockUseAppState.mockReturnValue(
      createMockAppState({
        cards,
        submissions: {},
        autoTimeEnabled: true,
        onSubmit,
        onSelfGrade,
      }),
    );

    let latest: HookState = null;
    const { cleanup } = renderHook((value) => {
      latest = value;
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSelfGrade).toHaveBeenCalledWith(0, "incorrect");
    expect(onSubmit).not.toHaveBeenCalled();
    expect((latest as { autoTimeEnabled: boolean } | null)?.autoTimeEnabled).toBe(true);

    cleanup();
    vi.useRealTimers();
  });

  it("does not restart timer on rerender while staying on same card", () => {
    const onSubmit = vi.fn();
    const onSelfGrade = vi.fn();
    const cards = [
      {
        kind: "multiple-choice",
        question: "Q1",
        options: [{ key: "a", text: "A" }],
        correctKeys: ["a"],
      },
    ];

    mockUseAppState.mockImplementation(() =>
      createMockAppState({
        cards,
        submissions: {},
        autoTimeEnabled: true,
        onSubmit,
        onSelfGrade,
      }),
    );

    const { rerender, cleanup } = renderHook(() => undefined);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    rerender();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(0, true);
    expect(onSelfGrade).not.toHaveBeenCalled();

    cleanup();
    vi.useRealTimers();
  });

  it("retargets timer to next unsubmitted visible card", () => {
    let submissions: Record<number, boolean> = {};
    const onSelfGrade = vi.fn();
    const onSubmit = vi.fn((cardIndex: number) => {
      submissions = { ...submissions, [cardIndex]: true };
    });
    const cards = [
      {
        kind: "multiple-choice",
        question: "Q1",
        options: [{ key: "a", text: "A" }],
        correctKeys: ["a"],
      },
      {
        kind: "multiple-choice",
        question: "Q2",
        options: [{ key: "b", text: "B" }],
        correctKeys: ["b"],
      },
    ];

    mockUseAppState.mockImplementation(() =>
      createMockAppState({
        cards,
        submissions,
        autoTimeEnabled: true,
        onSubmit,
        onSelfGrade,
      }),
    );

    const { rerender, cleanup } = renderHook(() => undefined);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(0, true);

    rerender();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(1, true);

    expect(onSelfGrade).not.toHaveBeenCalled();
    cleanup();
    vi.useRealTimers();
  });
});
