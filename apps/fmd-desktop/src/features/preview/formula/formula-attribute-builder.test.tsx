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

const resolveLatestOnChangeValue = (
  onChange: ReturnType<typeof vi.fn>,
  current: DatabaseFormulaDefinitionV1,
) => {
  const latestCall = onChange.mock.calls[onChange.mock.calls.length - 1];
  const latestArg = latestCall?.[0] as
    | DatabaseFormulaDefinitionV1
    | ((value: DatabaseFormulaDefinitionV1) => DatabaseFormulaDefinitionV1)
    | undefined;
  if (typeof latestArg === "function") {
    return latestArg(current);
  }
  return latestArg;
};

describe("FormulaAttributeBuilder", () => {
  it("renders attribute checkboxes and toggles multi selection", () => {
    const onChange = vi.fn();
    const initialValue = buildValue();
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: initialValue,
        attributes: [
          { key: "Status", label: "Status", supportsMath: true },
          { key: "Punkte", label: "Punkte", supportsMath: true },
        ],
        onChange,
      }),
    );

    const optionButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-formula-builder-scope='attributes'] [role='checkbox']",
      ),
    );
    expect(optionButtons).toHaveLength(2);
    expect(optionButtons[0]?.getAttribute("aria-checked")).toBe("true");
    expect(optionButtons[1]?.getAttribute("aria-checked")).toBe("false");

    act(() => {
      optionButtons[1]?.click();
    });

    const latestValue = resolveLatestOnChangeValue(onChange, initialValue);
    expect(latestValue?.attributeKeys).toEqual(["Status", "Punkte"]);

    cleanup();
  });

  it("uses single folder selection for explicit-folder source", () => {
    const onChange = vi.fn();
    const initialValue = buildValue({
      source: {
        type: "explicit-folder",
        path: "alpha",
      },
    });
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: initialValue,
        attributes: [{ key: "Status", label: "Status", supportsMath: true }],
        folderSuggestions: ["alpha", "beta"],
        onChange,
      }),
    );

    const radioButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-formula-builder-scope='explicit-folder'] [role='radio']",
      ),
    );
    expect(radioButtons).toHaveLength(2);

    act(() => {
      radioButtons[1]?.click();
    });

    const latestValue = resolveLatestOnChangeValue(onChange, initialValue);
    expect(latestValue?.source).toEqual({
      type: "explicit-folder",
      path: "beta",
    });

    cleanup();
  });

  it("uses checkbox multi select for multi-folder source", () => {
    const onChange = vi.fn();
    const initialValue = buildValue({
      source: {
        type: "multi-folder",
        paths: ["alpha"],
      },
    });
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: initialValue,
        attributes: [{ key: "Status", label: "Status", supportsMath: true }],
        folderSuggestions: ["alpha", "beta"],
        onChange,
      }),
    );

    const checkboxButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-formula-builder-scope='multi-folder'] [role='checkbox']",
      ),
    );
    expect(checkboxButtons).toHaveLength(2);
    expect(checkboxButtons[0]?.getAttribute("aria-checked")).toBe("true");
    expect(checkboxButtons[1]?.getAttribute("aria-checked")).toBe("false");

    act(() => {
      checkboxButtons[1]?.click();
    });

    const latestValue = resolveLatestOnChangeValue(onChange, initialValue);
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

  it("renders history as source option and shows history context details", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(FormulaAttributeBuilder, {
        value: buildValue({
          source: {
            type: "history",
          },
        }),
        attributes: [{ key: "Status", label: "Status", supportsMath: true }],
        historyFolderPath: "/vault/.profile/exam-runs",
        historyWarning: null,
        onChange,
      }),
    );

    const sourceSelect = Array.from(
      container.querySelectorAll<HTMLSelectElement>(".formula-attribute-builder-field > select"),
    ).find((select) => Array.from(select.options).some((option) => option.value === "history"));
    expect(sourceSelect).toBeTruthy();
    expect(Array.from(sourceSelect?.options ?? []).map((option) => option.value)).toEqual([
      "current-folder",
      "explicit-folder",
      "multi-folder",
      "history",
    ]);
    expect(container.textContent).toContain(
      "History verwendet die Exam-Runs des aktuellen Vaults.",
    );
    expect(container.textContent).toContain("Quelle: /vault/.profile/exam-runs");

    cleanup();
  });
});
