// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabasePropertiesPanel } from "./database-properties-panel";
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

const sampleAttribute: DatabaseAttributeMeta = {
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

const buildProps = () => ({
  attributes: [sampleAttribute],
  records: [],
  attributeSuggestions: [
    {
      key: "status",
      normalizedKey: "status",
      count: 3,
    },
    {
      key: "f-status",
      normalizedKey: "f-status",
      count: 1,
    },
  ],
  viewType: "table" as const,
  visibleColumnKeys: ["status"],
  kanbanShowCover: false,
  onKanbanShowCoverChange: vi.fn(),
  onToggleVisibility: vi.fn(),
  onReorderVisibleColumns: vi.fn(),
  onHideAll: vi.fn(),
  onRestoreDefault: vi.fn(),
  onCreateAttribute: vi.fn(async () => undefined),
  onCreateFormula: vi.fn(),
  isMutatingFrontmatter: false,
  onClose: vi.fn(),
});

describe("DatabasePropertiesPanel", () => {
  it("shows cover toggle only for kanban view", () => {
    const tableProps = buildProps();
    const { container: tableContainer, cleanup: cleanupTable } = render(
      createElement(DatabasePropertiesPanel, tableProps),
    );

    expect(tableContainer.textContent).not.toContain("Cover anzeigen");
    cleanupTable();

    const kanbanProps = {
      ...buildProps(),
      viewType: "kanban" as const,
    };
    const { container: kanbanContainer, cleanup: cleanupKanban } = render(
      createElement(DatabasePropertiesPanel, kanbanProps),
    );

    expect(kanbanContainer.textContent).toContain("Cover anzeigen");
    cleanupKanban();
  });

  it("forwards kanban cover toggle changes", () => {
    const props = {
      ...buildProps(),
      viewType: "kanban" as const,
    };
    const { container, cleanup } = render(
      createElement(DatabasePropertiesPanel, props),
    );

    const toggle = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='checkbox']"))
      .find((input) => input.parentElement?.textContent?.includes("Cover anzeigen"));

    act(() => {
      if (toggle) {
        toggle.checked = true;
      }
      toggle?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(props.onKanbanShowCoverChange).toHaveBeenCalledWith(true);

    cleanup();
  });

  it("removes legacy formula section and exposes unified core labels", () => {
    const props = buildProps();
    const { container, cleanup } = render(
      createElement(DatabasePropertiesPanel, props),
    );

    expect(container.textContent).not.toContain("Formel hinzufügen");
    expect(container.textContent).toContain("Zahlen");
    expect(container.textContent).toContain("Formel");
    expect(container.textContent).not.toContain("Nur Zahlen");

    cleanup();
  });

  it("filters attribute-key suggestions to f-* when formula type is selected", () => {
    const props = buildProps();
    const { container, cleanup } = render(
      createElement(DatabasePropertiesPanel, props),
    );

    const createSection = container.querySelector(".database-block-properties-create");
    const typeSelect = createSection?.querySelector<HTMLSelectElement>("select");
    const keyInput = createSection?.querySelector<HTMLInputElement>(".database-attribute-typeahead input");
    expect(typeSelect).toBeTruthy();
    expect(keyInput).toBeTruthy();

    act(() => {
      if (!typeSelect) {
        return;
      }
      typeSelect.value = "core:formula";
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    act(() => {
      keyInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      keyInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const optionKeys = Array.from(
      container.querySelectorAll<HTMLSpanElement>(
        ".database-attribute-typeahead-option > span:first-child",
      ),
    )
      .map((node) => node.textContent?.trim() ?? "")
      .filter((value) => value.length > 0);

    expect(optionKeys).toContain("f-status");
    expect(optionKeys).not.toContain("status");

    cleanup();
  });
});
