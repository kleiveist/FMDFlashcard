// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/components/flashcards/ClozeCard.pointer.test.tsx
 *
 * Zweck:
 * - Verifiziert Pointer-DnD fuer Cloze Drag-Tokens.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { getClozeDragPayload } from "../../features/flashcards/logic";
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
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const buildPointerEvent = (
  type: string,
  options: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
    button?: number;
  },
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: options.clientX });
  Object.defineProperty(event, "clientY", { value: options.clientY });
  Object.defineProperty(event, "pointerId", { value: options.pointerId });
  Object.defineProperty(event, "pointerType", { value: options.pointerType });
  Object.defineProperty(event, "button", { value: options.button ?? 0 });
  return event;
};

const buildClozeCard = (): ClozeCardType => ({
  kind: "cloze",
  subtype: "cd",
  question: "Drag token",
  segments: [
    { type: "text", value: "Token " },
    { type: "blank", id: "blank-0", kind: "drag", solution: "alpha" },
  ],
  dragTokens: [{ id: "token-0", value: "alpha" }],
});

describe("ClozeCard pointer drag", () => {
  it("drops the token on the highlighted blank", () => {
    const card = buildClozeCard();
    const onTokenDrop = vi.fn();
    const { container, cleanup } = render(
      createElement(ClozeCard, {
        card,
        cardIndex: 0,
        submitted: false,
        responses: {},
        onInputChange: () => {},
        onTokenDrop,
        onTokenRemove: () => {},
        onTokenDragStart: () => {},
        onBlankDragOver: () => {},
        onSubmit: () => {},
      }),
    );

    const tokenButton = container.querySelector(
      ".token-pool .token-chip",
    ) as HTMLButtonElement | null;
    const blank = container.querySelector(".cloze-blank.drag") as HTMLElement | null;

    expect(tokenButton).toBeTruthy();
    expect(blank).toBeTruthy();

    const originalElementsFromPoint = document.elementsFromPoint;
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: () => (blank ? [blank] : []),
    });

    act(() => {
      tokenButton?.dispatchEvent(
        buildPointerEvent("pointerdown", {
          clientX: 10,
          clientY: 10,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
      tokenButton?.dispatchEvent(
        buildPointerEvent("pointermove", {
          clientX: 30,
          clientY: 10,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
      tokenButton?.dispatchEvent(
        buildPointerEvent("pointerup", {
          clientX: 30,
          clientY: 10,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
    });

    expect(onTokenDrop).toHaveBeenCalledTimes(1);
    const [event, cardIndex, blankId] = onTokenDrop.mock.calls[0] ?? [];
    expect(cardIndex).toBe(0);
    expect(blankId).toBe("blank-0");
    const payload = getClozeDragPayload(event);
    expect(payload?.tokenId).toBe("token-0");

    if (originalElementsFromPoint) {
      Object.defineProperty(document, "elementsFromPoint", {
        configurable: true,
        value: originalElementsFromPoint,
      });
    } else {
      delete (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
    }
    cleanup();
  });
});
