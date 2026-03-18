// @vitest-environment jsdom
import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { ClozeCard as ClozeCardType } from "../../lib/flashcards";
import { ClozeCard } from "./ClozeCard";

const render = (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    rerender: (nextElement: ReactElement) => {
      act(() => {
        root.render(nextElement);
      });
    },
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

const buildTypedCard = (): ClozeCardType => ({
  kind: "cloze",
  subtype: "cl",
  question: "Typed cloze",
  segments: [
    { type: "text", value: "Answer " },
    { type: "blank", id: "blank-typed", kind: "input", solution: "one" },
  ],
  dragTokens: [],
});

const buildMixedCard = (): ClozeCardType => ({
  kind: "cloze",
  subtype: "cld",
  question: "Mixed cloze",
  segments: [
    { type: "text", value: "Type " },
    { type: "blank", id: "blank-typed", kind: "input", solution: "one" },
    { type: "text", value: " then drag " },
    { type: "blank", id: "blank-drag", kind: "drag", solution: "two" },
  ],
  dragTokens: [{ id: "token-0", value: "two" }],
});

const cloneCard = (card: ClozeCardType): ClozeCardType => ({
  ...card,
  segments: card.segments.map((segment) => ({ ...segment })),
  dragTokens: card.dragTokens.map((token) => ({ ...token })),
});

describe("ClozeCard focus stability", () => {
  it("keeps CL input focus across unrelated parent rerenders", () => {
    const card = buildTypedCard();
    const buildProps = () => ({
      card: cloneCard(card),
      cardIndex: 0,
      submitted: false,
      responses: {} as Record<string, string>,
      onInputChange: () => undefined,
      onTokenDrop: () => undefined,
      onTokenRemove: () => undefined,
      onTokenDragStart: () => undefined,
      onBlankDragOver: () => undefined,
      onSubmit: () => undefined,
    });
    const { container, rerender, cleanup } = render(
      createElement("div", { "data-tick": 0 }, createElement(ClozeCard, buildProps())),
    );

    const input = container.querySelector<HTMLInputElement>(".cloze-input");
    expect(input).toBeTruthy();

    act(() => {
      input?.focus();
    });
    expect(document.activeElement).toBe(input);

    rerender(
      createElement("div", { "data-tick": 1 }, createElement(ClozeCard, buildProps())),
    );

    const inputAfterFirstRerender =
      container.querySelector<HTMLInputElement>(".cloze-input");
    expect(document.activeElement).toBe(inputAfterFirstRerender);

    rerender(
      createElement("div", { "data-tick": 2 }, createElement(ClozeCard, buildProps())),
    );

    const inputAfterSecondRerender =
      container.querySelector<HTMLInputElement>(".cloze-input");
    expect(document.activeElement).toBe(inputAfterSecondRerender);
    cleanup();
  });

  it("keeps CLD input focus while typing and after manual idle rerenders", () => {
    const card = buildMixedCard();

    const Harness = () => {
      const [responses, setResponses] = useState<Record<string, string>>({});
      const [tick, setTick] = useState(0);

      return createElement(
        "div",
        { "data-tick": tick },
        createElement(
          "button",
          {
            type: "button",
            "data-testid": "force-rerender",
            onClick: () => setTick((previous) => previous + 1),
          },
          "rerender",
        ),
        createElement(ClozeCard, {
          card: cloneCard(card),
          cardIndex: 0,
          submitted: false,
          responses,
          onInputChange: (_cardIndex, blankId, value) =>
            setResponses((previous) => ({ ...previous, [blankId]: value })),
          onTokenDrop: () => undefined,
          onTokenRemove: () => undefined,
          onTokenDragStart: () => undefined,
          onBlankDragOver: () => undefined,
          onSubmit: () => undefined,
        }),
      );
    };

    const { container, cleanup } = render(createElement(Harness));

    const input = container.querySelector<HTMLInputElement>(".cloze-input");
    const rerenderButton =
      container.querySelector<HTMLButtonElement>('[data-testid="force-rerender"]');
    expect(input).toBeTruthy();
    expect(rerenderButton).toBeTruthy();

    act(() => {
      input?.focus();
    });
    expect(document.activeElement).toBe(input);

    if (!input || !rerenderButton) {
      cleanup();
      return;
    }

    typeInto(input, "o");
    expect(document.activeElement).toBe(input);

    typeInto(input, "on");
    expect(document.activeElement).toBe(input);

    act(() => {
      rerenderButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const inputAfterRerender =
      container.querySelector<HTMLInputElement>(".cloze-input");
    expect(document.activeElement).toBe(inputAfterRerender);
    expect(inputAfterRerender?.value).toBe("on");

    typeInto(inputAfterRerender as HTMLInputElement, "one");
    expect(document.activeElement).toBe(inputAfterRerender);
    expect(inputAfterRerender?.value).toBe("one");
    cleanup();
  });
});
