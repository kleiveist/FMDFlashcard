// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/components/RightOverlayRail.test.tsx
 *
 * Zweck:
 * - Tests fuer RightOverlayRail Sichtbarkeit und Pinning.
 */

import { act, createElement, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileIcon } from "./icons";
import { RightOverlayRail } from "./RightOverlayRail";

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

const dispatchMouseMove = (clientX: number) => {
  act(() => {
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX,
      }),
    );
  });
};

afterEach(() => {
  vi.useRealTimers();
});

describe("RightOverlayRail", () => {
  it("is hidden by default and becomes visible near the right edge", () => {
    const { cleanup } = render(
      <RightOverlayRail
        enabled
        actions={[
          {
            id: "note",
            icon: <FileIcon />,
            label: "Note",
            onClick: () => undefined,
          },
        ]}
      />,
    );

    const rail = document.querySelector<HTMLElement>(".right-overlay-rail");
    expect(rail).toBeTruthy();
    expect(rail?.classList.contains("is-visible")).toBe(false);

    dispatchMouseMove(window.innerWidth - 10);
    expect(rail?.classList.contains("is-visible")).toBe(true);
    cleanup();
  });

  it("stays visible while hovered and hides after the delay once hover ends", () => {
    vi.useFakeTimers();
    const { cleanup } = render(
      <RightOverlayRail
        enabled
        actions={[
          {
            id: "note",
            icon: <FileIcon />,
            label: "Note",
            onClick: () => undefined,
          },
        ]}
      />,
    );

    const rail = document.querySelector<HTMLElement>(".right-overlay-rail");
    expect(rail).toBeTruthy();

    dispatchMouseMove(window.innerWidth - 10);
    expect(rail?.classList.contains("is-visible")).toBe(true);

    act(() => {
      rail?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });
    dispatchMouseMove(10);
    expect(rail?.classList.contains("is-visible")).toBe(true);

    act(() => {
      rail?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    });

    act(() => {
      vi.advanceTimersByTime(179);
    });
    expect(rail?.classList.contains("is-visible")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(rail?.classList.contains("is-visible")).toBe(false);
    cleanup();
  });

  it("remains visible while pinned and hides after unpinning and delay", () => {
    vi.useFakeTimers();
    const Harness = () => {
      const [pinned, setPinned] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setPinned(false)}>
            Unpin
          </button>
          <RightOverlayRail
            enabled
            pinned={pinned}
            actions={[
              {
                id: "note",
                icon: <FileIcon />,
                label: "Note",
                onClick: () => undefined,
              },
            ]}
          />
        </>
      );
    };

    const { cleanup } = render(createElement(Harness));
    const rail = document.querySelector<HTMLElement>(".right-overlay-rail");
    const unpinButton = document.querySelector<HTMLButtonElement>("button");
    expect(rail?.classList.contains("is-visible")).toBe(true);

    act(() => {
      unpinButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    dispatchMouseMove(10);

    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(rail?.classList.contains("is-visible")).toBe(false);
    cleanup();
  });
});
