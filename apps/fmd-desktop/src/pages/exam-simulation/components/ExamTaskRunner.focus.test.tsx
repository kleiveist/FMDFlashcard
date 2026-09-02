// @vitest-environment jsdom
import {
  act,
  createElement,
  useEffect,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { CompositePartState } from "../../../features/flashcards/logic";
import type { ExamTask } from "../../../lib/exam";
import { isEditableTarget } from "../../../lib/shortcuts/bindings";
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

const buildSvgTask = (): ExamTask => ({
  id: "exam-task-focus-svg",
  index: 0,
  rawLines: ["Render SVG"],
  prompt: "Render SVG",
  gradingMode: "auto",
  sourceRange: { startLine: 0, endLine: 0 },
  cardWrapper: false,
  cardLines: ["Render SVG"],
  warnings: [],
  card: {
    kind: "composite",
    parts: [
      {
        kind: "free-text",
        front: [
          "```svg",
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">',
          '<rect x="1" y="1" width="118" height="38" fill="#fff" stroke="#111"/>',
          '<text x="10" y="25">Stable SVG</text>',
          "</svg>",
          "```",
        ].join("\n"),
        back: "Stable SVG",
      },
    ],
    primaryType: "qa",
    detectedTypes: ["qa"],
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
const noopClozeInputChange: ExamTaskRunnerProps["onClozeInputChange"] = (...args) => {
  void args;
};
const noopClozeTokenDrop: ExamTaskRunnerProps["onClozeTokenDrop"] = (...args) => {
  void args;
};
const noopClozeTokenRemove: ExamTaskRunnerProps["onClozeTokenRemove"] = (...args) => {
  void args;
};
const noopClozeTokenDragStart: ExamTaskRunnerProps["onClozeTokenDragStart"] = (...args) => {
  void args;
};
const noopBlankDragOver: ExamTaskRunnerProps["onBlankDragOver"] = (...args) => {
  void args;
};
const noopTextInputChange: ExamTaskRunnerProps["onTextInputChange"] = (...args) => {
  void args;
};
const noopAwardedPointsChange: ExamTaskRunnerProps["onAwardedPointsChange"] = (...args) => {
  void args;
};
const noopAutoGradeDecision: ExamTaskRunnerProps["onAutoGradeDecision"] = (...args) => {
  void args;
};
const noopNavigate = (...args: unknown[]) => {
  void args;
};

describe("ExamTaskRunner focus stability", () => {
  it("keeps svg preview subtree identity stable across timer-like host ticks", () => {
    const task = buildSvgTask();
    const stablePartStates: CompositePartState[] = [{}];

    const Harness = () => {
      const [tick, setTick] = useState(0);
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
          task,
          taskIndex: 0,
          taskCount: 1,
          maxPoints: 5,
          phase: "exam",
          partStates: stablePartStates,
          awardedPoints: null,
          onOptionSelect: noopOptionSelect,
          onTrueFalseSelect: noopTrueFalseSelect,
          onClozeInputChange: noopClozeInputChange,
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
          showNavigation: false,
        }),
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const tickButton = container.querySelector<HTMLButtonElement>('[data-testid="tick"]');
    const svgNodeBeforeTick = container.querySelector<SVGSVGElement>(
      ".flashcard-media-svg-surface svg",
    );
    expect(tickButton).toBeTruthy();
    expect(svgNodeBeforeTick).toBeTruthy();

    if (!tickButton || !svgNodeBeforeTick) {
      cleanup();
      return;
    }

    act(() => {
      tickButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      tickButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const svgNodeAfterTicks = container.querySelector<SVGSVGElement>(
      ".flashcard-media-svg-surface svg",
    );
    expect(svgNodeAfterTicks).toBe(svgNodeBeforeTick);
    cleanup();
  });

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
    const tickButton = container.querySelector<HTMLButtonElement>('[data-testid="tick"]');
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

    const inputAfterFirstTick = container.querySelector<HTMLInputElement>(".cloze-input");
    expect(document.activeElement).toBe(inputAfterFirstTick);

    typeInto(inputAfterFirstTick as HTMLInputElement, "on");
    expect(document.activeElement).toBe(inputAfterFirstTick);
    expect(inputAfterFirstTick?.value).toBe("on");

    act(() => {
      tickButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const inputAfterSecondTick = container.querySelector<HTMLInputElement>(".cloze-input");
    expect(document.activeElement).toBe(inputAfterSecondTick);
    expect(inputAfterSecondTick?.value).toBe("on");
    cleanup();
  });

  it("keeps focused cloze input stable when host arrow-key navigation is active", () => {
    const task = buildTask();

    const Harness = () => {
      const [partStates, setPartStates] = useState<CompositePartState[]>([{}]);
      const [navigationCount, setNavigationCount] = useState(0);

      useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.defaultPrevented) {
            return;
          }
          if (isEditableTarget(event.target)) {
            return;
          }
          if (event.key !== "ArrowRight") {
            return;
          }
          event.preventDefault();
          setNavigationCount((previous) => previous + 1);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
      }, []);

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
        null,
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "outside-control",
          },
          "outside",
        ),
        createElement(
          "output",
          {
            "data-testid": "navigation-count",
          },
          String(navigationCount),
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
    const outsideControl = container.querySelector<HTMLButtonElement>(
      '[data-testid="outside-control"]',
    );
    const navigationCountOutput = container.querySelector<HTMLOutputElement>(
      '[data-testid="navigation-count"]',
    );
    expect(input).toBeTruthy();
    expect(outsideControl).toBeTruthy();
    expect(navigationCountOutput).toBeTruthy();

    if (!input || !outsideControl || !navigationCountOutput) {
      cleanup();
      return;
    }

    act(() => {
      input.focus();
    });
    expect(document.activeElement).toBe(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    expect(document.activeElement).toBe(input);
    expect(navigationCountOutput.textContent).toBe("0");

    act(() => {
      outsideControl.focus();
    });
    expect(document.activeElement).toBe(outsideControl);

    act(() => {
      outsideControl.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });

    expect(navigationCountOutput.textContent).toBe("1");
    cleanup();
  });
});
