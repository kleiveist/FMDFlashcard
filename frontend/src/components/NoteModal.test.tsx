// @vitest-environment jsdom
/**
 * @file frontend/src/components/NoteModal.test.tsx
 *
 * Zweck:
 * - Tests fuer NoteModal Interaktionen (ESC, Backdrop, aria-expanded).
 */

import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { NoteModal } from "./NoteModal";

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

describe("NoteModal", () => {
  it("toggles aria-expanded and closes via ESC and backdrop", () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            aria-label="Open note"
            aria-haspopup="dialog"
            aria-expanded={open}
            title="Note"
            onClick={() => setOpen(true)}
          >
            Note
          </button>
          <NoteModal isOpen={open} onClose={() => setOpen(false)}>
            <div>Note Files</div>
          </NoteModal>
        </>
      );
    };

    const { container, cleanup } = render(createElement(Harness));
    const trigger = container.querySelector("button");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".modal-backdrop")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".modal-backdrop")).toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const backdrop = document.querySelector(".modal-backdrop");
    expect(backdrop).toBeTruthy();

    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    cleanup();
  });

  it("renders header actions in modal header", () => {
    const { cleanup } = render(
      createElement(
        NoteModal,
        {
          isOpen: true,
          onClose: () => undefined,
          headerActions: createElement("span", { className: "chip" }, "7 tasks"),
          children: createElement("div", null, "Note Files"),
        },
      ),
    );

    expect(document.querySelector(".modal-panel-header .chip")?.textContent).toBe("7 tasks");
    cleanup();
  });
});
