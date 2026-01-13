/**
 * @file apps/fmd-desktop/src/components/flashcards/ClozeCard.test.tsx
 *
 * Zweck:
 * - Testet Rendering und Feedback fuer Cloze-Karten.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
});
