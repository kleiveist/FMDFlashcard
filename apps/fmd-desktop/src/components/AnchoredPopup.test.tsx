// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/components/AnchoredPopup.test.tsx
 *
 * Zweck:
 * - Tests fuer AnchoredPopup Interaktionen (X, ESC, Outside-Click, Fokus).
 */

import { act, createElement, useRef, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AnchoredPopup } from "./AnchoredPopup";

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

describe("AnchoredPopup", () => {
  it("opens and closes via outside click, escape, and close button", () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label="Open popup"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            Open
          </button>
          <AnchoredPopup
            isOpen={open}
            onClose={() => setOpen(false)}
            anchorRef={triggerRef}
            closeLayerId="anchored-popup-test"
            ariaLabel="Popup test"
          >
            <section className="panel">
              <div className="panel-body">
                <button type="button">Inner button</button>
              </div>
            </section>
          </AnchoredPopup>
        </>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Open popup"]');
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".anchored-popup")).toBeTruthy();

    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".anchored-popup")).toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector(".anchored-popup")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".anchored-popup")).toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const closeButton = document.querySelector<HTMLButtonElement>(".anchored-popup-close");
    expect(closeButton).toBeTruthy();

    act(() => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    cleanup();
  });
});
