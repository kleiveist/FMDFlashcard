// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseAttributeTypeahead } from "./database-attribute-typeahead";
import { setNativeValue } from "../../../../../test/dom";

const suggestions = [
  { key: "status", normalizedKey: "status", count: 4 },
  { key: "start", normalizedKey: "start", count: 2 },
  { key: "priority", normalizedKey: "priority", count: 1 },
];

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

describe("DatabaseAttributeTypeahead", () => {
  it("opens suggestions on focus and filters live", () => {
    const onValueChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseAttributeTypeahead, {
        value: "",
        suggestions,
        onValueChange,
        placeholder: "Attribut",
      }),
    );

    const input = container.querySelector<HTMLInputElement>("input");
    expect(input).toBeTruthy();

    act(() => {
      input?.dispatchEvent(new Event("focus", { bubbles: true }));
      input?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("status");
    expect(container.textContent).toContain("priority");

    act(() => {
      if (input) {
        setNativeValue(input, "ta");
      }
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.textContent).toContain("status");
    expect(container.textContent).not.toContain("priority");
    expect(onValueChange).toHaveBeenCalledWith("ta");

    cleanup();
  });

  it("enforces strict selection and commits selected suggestion", () => {
    const onValueChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseAttributeTypeahead, {
        value: "status",
        suggestions,
        strictSelection: true,
        onValueChange,
        placeholder: "Attribut",
      }),
    );

    const input = container.querySelector<HTMLInputElement>("input");
    expect(input).toBeTruthy();

    act(() => {
      input?.dispatchEvent(new Event("focus", { bubbles: true }));
      input?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      if (input) {
        setNativeValue(input, "sta");
      }
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onValueChange).not.toHaveBeenCalledWith("sta");

    const firstOption = container.querySelector<HTMLButtonElement>(
      ".database-attribute-typeahead-option",
    );
    expect(firstOption).toBeTruthy();

    act(() => {
      firstOption?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledWith("status");

    cleanup();
  });

  it("shows empty-state label when no suggestion matches", () => {
    const { container, cleanup } = render(
      createElement(DatabaseAttributeTypeahead, {
        value: "",
        suggestions,
        strictSelection: true,
        onValueChange: vi.fn(),
        placeholder: "Attribut",
      }),
    );

    const input = container.querySelector<HTMLInputElement>("input");
    expect(input).toBeTruthy();

    act(() => {
      input?.dispatchEvent(new Event("focus", { bubbles: true }));
      input?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      if (input) {
        setNativeValue(input, "zzz");
      }
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.textContent).toContain("Keine passenden Attribute gefunden");

    cleanup();
  });
});
