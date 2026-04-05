// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseFilterPanel } from "./database-filter-panel";
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

const suggestions = [
  {
    key: "status",
    normalizedKey: "status",
    count: 3,
  },
];

describe("DatabaseFilterPanel", () => {
  it("renders view-specific filter impact hints", () => {
    const expectations: Array<[DatabaseViewType, string]> = [
      ["table", "Tabellenzeilen"],
      ["kanban", "Karten im Kanban-Board"],
      ["gantt", "Liste links und Balkenzeilen rechts"],
      ["project", "Liste links und Blockzeilen rechts"],
      ["pie", "Datengrundlage des Pie-Charts"],
    ];

    expectations.forEach(([viewType, expectedText]) => {
      const { container, cleanup } = render(
        createElement(DatabaseFilterPanel, {
          attributes: [attribute],
          attributeSuggestions: suggestions,
          viewType,
          filterGroup: {
            id: "root",
            op: "and",
            rules: [],
          },
          onChange: vi.fn(),
          onClose: vi.fn(),
        }),
      );

      expect(container.textContent).toContain(expectedText);
      cleanup();
    });
  });
});
