// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseSortPanel } from "./database-sort-panel";
import {
  type DatabaseAttributeMeta,
  type DatabaseViewType,
} from "../database-types";

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

const attribute: DatabaseAttributeMeta = {
  key: "priority",
  label: "Priority",
  type: "number",
  origin: "frontmatter",
  formula: null,
  editable: true,
  sortable: true,
  filterable: true,
  aggregatable: true,
  viewCompatibility: {
    supportsTable: true,
    supportsKanbanGrouping: false,
    supportsTimeline: false,
    supportsPieGrouping: false,
    supportsAggregation: true,
  },
};

describe("DatabaseSortPanel", () => {
  it("renders view-specific sort impact hints", () => {
    const expectations: Array<[DatabaseViewType, string]> = [
      ["table", "Tabellenzeilen"],
      ["kanban", "Karten innerhalb jeder Spalte"],
      ["gantt", "vertikale Reihenfolge links und rechts"],
      ["project", "vertikale Reihenfolge links und rechts"],
      ["pie", "Segmenten und Legende"],
    ];

    expectations.forEach(([viewType, expectedText]) => {
      const { container, cleanup } = render(
        createElement(DatabaseSortPanel, {
          attributes: [attribute],
          viewType,
          sortRules: [],
          onChange: vi.fn(),
          onClose: vi.fn(),
        }),
      );

      expect(container.textContent).toContain(expectedText);
      cleanup();
    });
  });
});
