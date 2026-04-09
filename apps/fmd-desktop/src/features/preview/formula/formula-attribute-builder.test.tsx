// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { FormulaAttributeBuilder } from "./formula-attribute-builder";
import {
  DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE,
  type DatabaseFormulaDefinitionV1,
} from "./database-formula-types";

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

const buildValue = (
  overrides?: Partial<DatabaseFormulaDefinitionV1>,
): DatabaseFormulaDefinitionV1 => ({
  version: 1,
  operation: "count",
  attributeKeys: ["Status"],
  source: { type: "current-folder" },
  shortTextRule: { ...DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE },
  ...overrides,
});

describe("FormulaAttributeBuilder", () => {
  it("renders attribute checkboxes and toggles multi selection", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: buildValue(),
        attributes: [
          { key: "Status", label: "Status", supportsMath: true },
          { key: "Punkte", label: "Punkte", supportsMath: true },
        ],
        onChange,
      }),
    );

    const optionButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("[data-formula-builder-scope='attributes'] [role='checkbox']"),
    );
    expect(optionButtons).toHaveLength(2);
    expect(optionButtons[0]?.getAttribute("aria-checked")).toBe("true");
    expect(optionButtons[1]?.getAttribute("aria-checked")).toBe("false");

    act(() => {
      optionButtons[1]?.click();
    });

    const latestValue = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as
      | DatabaseFormulaDefinitionV1
      | undefined;
    expect(latestValue?.attributeKeys).toEqual(["Status", "Punkte"]);

    cleanup();
  });

  it("uses single folder selection for explicit-folder source", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: buildValue({
          source: {
            type: "explicit-folder",
            path: "alpha",
          },
        }),
        attributes: [{ key: "Status", label: "Status", supportsMath: true }],
        folderSuggestions: ["alpha", "beta"],
        onChange,
      }),
    );

    const radioButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("[data-formula-builder-scope='explicit-folder'] [role='radio']"),
    );
    expect(radioButtons).toHaveLength(2);

    act(() => {
      radioButtons[1]?.click();
    });

    const latestValue = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as
      | DatabaseFormulaDefinitionV1
      | undefined;
    expect(latestValue?.source).toEqual({
      type: "explicit-folder",
      path: "beta",
    });

    cleanup();
  });

  it("uses checkbox multi select for multi-folder source", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: buildValue({
          source: {
            type: "multi-folder",
            paths: ["alpha"],
          },
        }),
        attributes: [{ key: "Status", label: "Status", supportsMath: true }],
        folderSuggestions: ["alpha", "beta"],
        onChange,
      }),
    );

    const checkboxButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("[data-formula-builder-scope='multi-folder'] [role='checkbox']"),
    );
    expect(checkboxButtons).toHaveLength(2);
    expect(checkboxButtons[0]?.getAttribute("aria-checked")).toBe("true");
    expect(checkboxButtons[1]?.getAttribute("aria-checked")).toBe("false");

    act(() => {
      checkboxButtons[1]?.click();
    });

    const latestValue = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as
      | DatabaseFormulaDefinitionV1
      | undefined;
    expect(latestValue?.source).toEqual({
      type: "multi-folder",
      paths: ["alpha", "beta"],
    });

    cleanup();
  });

  it("keeps manual folder input as fallback when no folder suggestions exist", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: buildValue({
          source: {
            type: "explicit-folder",
            path: "",
          },
        }),
        attributes: [{ key: "Status", label: "Status", supportsMath: true }],
        folderSuggestions: [],
        onChange,
      }),
    );

    expect(container.querySelector("[data-formula-builder-scope='explicit-folder']")).toBeNull();
    const fallbackInput = container.querySelector<HTMLInputElement>(
      ".formula-attribute-builder-field input[placeholder='z.B. Projekte/Sprint']",
    );
    expect(fallbackInput).toBeTruthy();

    cleanup();
  });
});
