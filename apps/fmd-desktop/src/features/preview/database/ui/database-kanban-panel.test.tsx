// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseKanbanPanel } from "./database-kanban-panel";
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

const ownerAttribute: DatabaseAttributeMeta = {
  key: "owner",
  label: "Owner",
  type: "text",
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

const renderPanel = (props?: Partial<Parameters<typeof DatabaseKanbanPanel>[0]>) => {
  const onChange = vi.fn();
  return {
    onChange,
    ...render(
      createElement(DatabaseKanbanPanel, {
        attributes: [statusAttribute, ownerAttribute],
        groupField: "status",
        valueOptions: [
          { value: "Open", label: "Open", count: 2 },
          { value: "Done", label: "Done", count: 1 },
        ],
        excludedValues: [],
        onChange,
        onClose: vi.fn(),
        ...props,
      }),
    ),
  };
};

describe("DatabaseKanbanPanel", () => {
  it("renders group value checkboxes and excludes unchecked values", () => {
    const { container, cleanup, onChange } = renderPanel();

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
    const { container, cleanup, onChange } = renderPanel({
      excludedValues: ["Done"],
    });

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

  it("forwards group field changes", () => {
    const { container, cleanup, onChange } = renderPanel();

    const select = container.querySelector<HTMLSelectElement>("select");
    act(() => {
      if (select) {
        select.value = "owner";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalledWith({ groupField: "owner" });
    cleanup();
  });
});
