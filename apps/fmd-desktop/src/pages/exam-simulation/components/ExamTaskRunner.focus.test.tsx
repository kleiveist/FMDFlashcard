// @vitest-environment jsdom
import {
  act,
  createElement,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { CompositePartState } from "../../../features/flashcards/logic";
import type { ExamTask } from "../../../lib/exam";
import { ExamTaskRunner } from "./ExamTaskRunner";

type ExamTaskRunnerProps = ComponentProps<typeof ExamTaskRunner>;

const render = (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const typeInto = (input: HTMLInputElement, value: string) => {
  act(() => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const buildTask = (): ExamTask => ({
  id: "exam-task-focus-1",
  index: 0,
  rawLines: ["Fill answer"],
  prompt: "Fill answer",
  gradingMode: "auto",
  sourceRange: { startLine: 0, endLine: 0 },
  cardWrapper: false,
  cardLines: ["Fill answer"],
  warnings: [],
  card: {
    kind: "composite",
    parts: [
      {
        kind: "cloze",
        subtype: "cld",
        question: "Type then drag",
        segments: [
          { type: "text", value: "Type " },
          { type: "blank", id: "blank-typed", kind: "input", solution: "one" },
          { type: "text", value: " and drag " },
          { type: "blank", id: "blank-drag", kind: "drag", solution: "two" },
        ],
        dragTokens: [{ id: "token-0", value: "two" }],
      },
    ],
    primaryType: "fill-blank",
    detectedTypes: ["fill-blank"],
    isMixed: false,
  },
});

const cloneTask = (task: ExamTask): ExamTask => ({
  ...task,
  rawLines: [...task.rawLines],
  cardLines: [...task.cardLines],
  warnings: [...task.warnings],
  card: {
    ...task.card,
    parts: task.card.parts.map((part) => {
      if (part.kind !== "cloze") {
        return { ...part };
      }
      return {
        ...part,
        segments: part.segments.map((segment) => ({ ...segment })),
        dragTokens: part.dragTokens.map((token) => ({ ...token })),
      };
    }),
  },
});

const noopOptionSelect: ExamTaskRunnerProps["onOptionSelect"] = (...args) => {
  void args;
};
const noopTrueFalseSelect: ExamTaskRunnerProps["onTrueFalseSelect"] = (...args) => {
  void args;
};
const noopClozeTokenDrop: ExamTaskRunnerProps["onClozeTokenDrop"] = (...args) => {
  void args;
};
const noopClozeTokenRemove: ExamTaskRunnerProps["onClozeTokenRemove"] = (...args) => {
  void args;
};
const noopClozeTokenDragStart: ExamTaskRunnerProps["onClozeTokenDragStart"] = (
  ...args
) => {
  void args;
};
const noopBlankDragOver: ExamTaskRunnerProps["onBlankDragOver"] = (...args) => {
  void args;
};
const noopTextInputChange: ExamTaskRunnerProps["onTextInputChange"] = (...args) => {
  void args;
};
const noopAwardedPointsChange: ExamTaskRunnerProps["onAwardedPointsChange"] = (
  ...args
) => {
  void args;
};
const noopAutoGradeDecision: ExamTaskRunnerProps["onAutoGradeDecision"] = (
  ...args
) => {
  void args;
};
const noopNavigate = (...args: unknown[]) => {
  void args;
};

describe("ExamTaskRunner focus stability", () => {
  it("keeps active cloze input focused across timer-like parent rerenders", () => {
    const task = buildTask();

    const Harness = () => {
      const [partStates, setPartStates] = useState<CompositePartState[]>([{}]);
      const [tick, setTick] = useState(0);

      const handleClozeInputChange: ExamTaskRunnerProps["onClozeInputChange"] = (
        _taskIndex,
        partIndex,
        blankId,
        value,
      ) => {
        setPartStates((previous) => {
          const next = [...previous];
          const current = next[partIndex] ?? {};
          next[partIndex] = {
            ...current,
            clozeResponses: {
              ...(current.clozeResponses ?? {}),
              [blankId]: value,
            },
          };
          return next;
        });
      };

      return createElement(
        "div",
        { "data-tick": tick },
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "tick",
            onClick: () => setTick((previous) => previous + 1),
          },
          "tick",
        ),
        createElement(ExamTaskRunner, {
          task: cloneTask(task),
          taskIndex: 0,
          taskCount: 1,
          maxPoints: 5,
          phase: "exam",
          partStates,
          awardedPoints: null,
          onOptionSelect: noopOptionSelect,
          onTrueFalseSelect: noopTrueFalseSelect,
          onClozeInputChange: handleClozeInputChange,
          onClozeTokenDrop: noopClozeTokenDrop,
          onClozeTokenRemove: noopClozeTokenRemove,
          onClozeTokenDragStart: noopClozeTokenDragStart,
          onBlankDragOver: noopBlankDragOver,
          onTextInputChange: noopTextInputChange,
          onAwardedPointsChange: noopAwardedPointsChange,
          onAutoGradeDecision: noopAutoGradeDecision,
          onBack: noopNavigate,
          onNext: noopNavigate,
          canGoBack: false,
          canGoNext: false,
        }),
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const input = container.querySelector<HTMLInputElement>(".cloze-input");
    const tickButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="tick"]',
    );
    expect(input).toBeTruthy();
    expect(tickButton).toBeTruthy();

    if (!input || !tickButton) {
      cleanup();
      return;
    }

    act(() => {
      input.focus();
    });
    expect(document.activeElement).toBe(input);

    typeInto(input, "o");
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("o");

    act(() => {
      tickButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const inputAfterFirstTick =
      container.querySelector<HTMLInputElement>(".cloze-input");
    expect(document.activeElement).toBe(inputAfterFirstTick);

    typeInto(inputAfterFirstTick as HTMLInputElement, "on");
    expect(document.activeElement).toBe(inputAfterFirstTick);
    expect(inputAfterFirstTick?.value).toBe("on");

    act(() => {
      tickButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const inputAfterSecondTick =
      container.querySelector<HTMLInputElement>(".cloze-input");
    expect(document.activeElement).toBe(inputAfterSecondTick);
    expect(inputAfterSecondTick?.value).toBe("on");
    cleanup();
  });
});
