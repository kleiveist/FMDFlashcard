// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabasePiePanel } from "./database-pie-panel";
import { type DatabaseAttributeMeta } from "../database-types";

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

const statusAttribute: DatabaseAttributeMeta = {
  key: "status",
  label: "Status",
  type: "status",
  origin: "frontmatter",
  formula: null,
  editable: true,
  sortable: true,
  filterable: true,
  aggregatable: false,
  viewCompatibility: {
    supportsTable: true,
    supportsKanbanGrouping: true,
    supportsTimeline: false,
    supportsPieGrouping: true,
    supportsAggregation: false,
  },
};

describe("DatabasePiePanel", () => {
  it("renders group value checkboxes and excludes unchecked values", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabasePiePanel, {
        attributes: [statusAttribute],
        groupField: "status",
        aggregate: "count",
        aggregateField: null,
        valueOptions: [
          { value: "Open", count: 2 },
          { value: "Done", count: 1 },
        ],
        excludedValues: [],
        colorSpectrum: "standard",
        onChange,
        onClose: vi.fn(),
      }),
    );

    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
    );
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);

    act(() => {
      checkboxes[1]?.click();
    });

    expect(onChange).toHaveBeenCalledWith({ excludedValues: ["Done"] });
    cleanup();
  });

  it("allows excluded values to be re-enabled", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabasePiePanel, {
        attributes: [statusAttribute],
        groupField: "status",
        aggregate: "count",
        aggregateField: null,
        valueOptions: [
          { value: "Open", count: 2 },
          { value: "Done", count: 1 },
        ],
        excludedValues: ["Done"],
        colorSpectrum: "standard",
        onChange,
        onClose: vi.fn(),
      }),
    );

    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
    );
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[1]?.checked).toBe(false);

    act(() => {
      checkboxes[1]?.click();
    });

    expect(onChange).toHaveBeenCalledWith({ excludedValues: [] });
    cleanup();
  });

  it("updates selected pie color spectrum", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabasePiePanel, {
        attributes: [statusAttribute],
        groupField: "status",
        aggregate: "count",
        aggregateField: null,
        valueOptions: [],
        excludedValues: [],
        colorSpectrum: "standard",
        onChange,
        onClose: vi.fn(),
      }),
    );

    const spectrumButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[role='radio']"),
    ).find((button) => button.textContent?.includes("Ozean"));
    expect(spectrumButton).toBeTruthy();

    act(() => {
      spectrumButton?.click();
    });

    expect(onChange).toHaveBeenCalledWith({ colorSpectrum: "ocean" });
    cleanup();
  });

  it("does not render an aggregate field control", () => {
    const { container, cleanup } = render(
      createElement(DatabasePiePanel, {
        attributes: [statusAttribute],
        groupField: "status",
        aggregate: "count",
        aggregateField: null,
        valueOptions: [],
        excludedValues: [],
        colorSpectrum: "standard",
        onChange: vi.fn(),
        onClose: vi.fn(),
      }),
    );

    expect(container.textContent).not.toContain("Aggregatfeld");
    expect(container.querySelectorAll("select")).toHaveLength(2);
    cleanup();
  });
});
