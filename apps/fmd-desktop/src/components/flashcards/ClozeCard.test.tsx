// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/components/flashcards/ClozeCard.test.tsx
 *
 * Zweck:
 * - Testet Rendering und Feedback fuer Cloze-Karten.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClozeCard } from "./ClozeCard";
import type { ClozeCard as ClozeCardType } from "../../lib/flashcards";

const buildClozeCard = (): ClozeCardType => ({
  kind: "cloze",
  subtype: "cld",
  question: "Mixed cloze",
  segments: [
    { type: "text", value: "Answer " },
    { type: "blank", id: "blank-0", kind: "input", solution: "one" },
    { type: "text", value: " then " },
    { type: "blank", id: "blank-1", kind: "drag", solution: "two" },
    { type: "text", value: "." },
  ],
  dragTokens: [
    { id: "token-0", value: "two" },
    { id: "token-1", value: "three" },
  ],
});

const buildDragOnlyCard = (question: string, tokenPrefix: string): ClozeCardType => ({
  kind: "cloze",
  subtype: "cd",
  question,
  segments: [
    { type: "text", value: "Token " },
    { type: "blank", id: "blank-0", kind: "drag", solution: `${tokenPrefix}-0` },
  ],
  dragTokens: Array.from({ length: 6 }, (_, index) => ({
    id: `${tokenPrefix}-${index}`,
    value: `${tokenPrefix}-${index}`,
  })),
});

const cloneCard = (card: ClozeCardType): ClozeCardType => ({
  ...card,
  segments: card.segments.map((segment) => ({ ...segment })),
  dragTokens: card.dragTokens.map((token) => ({ ...token })),
});

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

const readTokenOrder = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>(".token-pool .token-chip")).map(
    (chip) => chip.textContent?.trim() ?? "",
  );

describe("ClozeCard", () => {
  it("renders per-blank correctness and overall result after submit", () => {
    const card = buildClozeCard();
    const markup = renderToStaticMarkup(
      createElement(ClozeCard, {
        card,
        cardIndex: 0,
        submitted: true,
        responses: { "blank-0": "ONE", "blank-1": "token-1" },
        onInputChange: () => {},
        onTokenDrop: () => {},
        onTokenRemove: () => {},
        onTokenDragStart: () => {},
        onBlankDragOver: () => {},
        onSubmit: () => {},
      }),
    );

    expect(markup).toContain("cloze-card");
    expect(markup).toContain("cloze-blank input filled correct");
    expect(markup).toContain("cloze-blank drag filled incorrect");
    expect(markup).toContain("flashcard-result incorrect");
  });

  it("renders CL inputs inside fenced code blocks", () => {
    const card: ClozeCardType = {
      kind: "cloze",
      subtype: "cl",
      question: "",
      segments: [
        { type: "text", value: "```sql\nSELECT " },
        { type: "blank", id: "blank-0", kind: "input", solution: "column" },
        { type: "text", value: " FROM country;\n```" },
      ],
      dragTokens: [],
    };

    const markup = renderToStaticMarkup(
      createElement(ClozeCard, {
        card,
        cardIndex: 0,
        submitted: false,
        responses: {},
        onInputChange: () => {},
        onTokenDrop: () => {},
        onTokenRemove: () => {},
        onTokenDragStart: () => {},
        onBlankDragOver: () => {},
        onSubmit: () => {},
      }),
    );

    expect(markup).toContain("flashcard-code-block");
    expect(markup).toContain("cloze-input");
    expect(markup).not.toContain("@@@CLOZE:");
  });

  it("renders CD drop zones inside fenced code blocks", () => {
    const card: ClozeCardType = {
      kind: "cloze",
      subtype: "cd",
      question: "",
      segments: [
        { type: "text", value: "```sql\nSELECT " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "token" },
        { type: "text", value: ";\n```" },
      ],
      dragTokens: [{ id: "token-0", value: "token" }],
    };

    const markup = renderToStaticMarkup(
      createElement(ClozeCard, {
        card,
        cardIndex: 0,
        submitted: false,
        responses: {},
        onInputChange: () => {},
        onTokenDrop: () => {},
        onTokenRemove: () => {},
        onTokenDragStart: () => {},
        onBlankDragOver: () => {},
        onSubmit: () => {},
      }),
    );

    expect(markup).toContain("flashcard-code-block");
    expect(markup).toContain("cloze-blank drag");
    expect(markup).toContain('data-dropzone="cloze-blank"');
    expect(markup).not.toContain("@@@CLOZE:");
  });

  it("keeps drag token order stable across parent rerenders for the same card view", () => {
    const card = buildDragOnlyCard("Token order", "same-view");
    const baseProps = {
      card,
      cardIndex: 0,
      submitted: false,
      responses: {},
      onInputChange: () => {},
      onTokenDrop: () => {},
      onTokenRemove: () => {},
      onTokenDragStart: () => {},
      onBlankDragOver: () => {},
      onSubmit: () => {},
    };
    const { container, rerender, cleanup } = render(
      createElement("div", { "data-tick": 0 }, createElement(ClozeCard, baseProps)),
    );
    try {
      const initialOrder = readTokenOrder(container);
      expect(initialOrder).toHaveLength(6);

      rerender(
        createElement(
          "div",
          { "data-tick": 1 },
          createElement(ClozeCard, {
            ...baseProps,
            card: cloneCard(card),
          }),
        ),
      );

      const rerenderOrder = readTokenOrder(container);
      expect(rerenderOrder).toEqual(initialOrder);
    } finally {
      cleanup();
    }
  });

  it("reshuffles drag token order after card switches and revisit", () => {
    const randomUuidSpy = vi.spyOn(globalThis.crypto, "randomUUID");
    const cardA = buildDragOnlyCard("Card A", "card-a");
    const cardB = buildDragOnlyCard("Card B", "card-b");
    const renderCard = (card: ClozeCardType, cardIndex: number) =>
      createElement(ClozeCard, {
        card,
        cardIndex,
        submitted: false,
        responses: {},
        onInputChange: () => {},
        onTokenDrop: () => {},
        onTokenRemove: () => {},
        onTokenDragStart: () => {},
        onBlankDragOver: () => {},
        onSubmit: () => {},
      });

    randomUuidSpy
      .mockReturnValueOnce("00000000-0000-4000-8000-0000000000a1")
      .mockReturnValueOnce("00000000-0000-4000-8000-0000000000b1")
      .mockReturnValueOnce("00000000-0000-4000-8000-0000000000a2");

    const { container, rerender, cleanup } = render(renderCard(cardA, 0));
    try {
      const initialAOrder = readTokenOrder(container);
      expect(initialAOrder).toHaveLength(6);

      rerender(renderCard(cardB, 1));
      const orderB = readTokenOrder(container);
      expect(orderB).toHaveLength(6);

      rerender(renderCard(cardA, 0));
      const revisitedAOrder = readTokenOrder(container);
      expect(revisitedAOrder).toHaveLength(6);
      expect(revisitedAOrder).not.toEqual(initialAOrder);
    } finally {
      randomUuidSpy.mockRestore();
      cleanup();
    }
  });
});
