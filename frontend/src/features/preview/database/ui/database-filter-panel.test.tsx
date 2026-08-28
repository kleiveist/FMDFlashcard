// @vitest-environment jsdom
import { act, createElement, type ReactElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseFilterPanel } from "./database-filter-panel";
import {
  type DatabaseAttributeMeta,
  type DatabaseFilterGroup,
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

  it("shows value suggestions for the selected filter attribute", () => {
    const onChange = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseFilterPanel, {
        attributes: [attribute],
        attributeSuggestions: suggestions,
        valueSuggestionsByField: {
          status: [
            { key: "Offen", normalizedKey: "offen", count: 3 },
            { key: "Erledigt", normalizedKey: "erledigt", count: 2 },
          ],
        },
        viewType: "table",
        filterGroup: {
          id: "root",
          op: "and",
          rules: [
            {
              id: "rule-1",
              field: "status",
              op: "is",
              value: "",
            },
          ],
        },
        onChange,
        onClose: vi.fn(),
      }),
    );

    const valueInput = container.querySelector<HTMLInputElement>("input[placeholder='Wert']");
    expect(valueInput).toBeTruthy();

    act(() => {
      valueInput?.dispatchEvent(new Event("focus", { bubbles: true }));
      valueInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Offen");
    expect(container.textContent).toContain("Erledigt");

    cleanup();
  });

  it("keeps the panel open when adding a rule or group", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseFilterPanel, {
        attributes: [attribute],
        attributeSuggestions: suggestions,
        viewType: "table",
        filterGroup: {
          id: "root",
          op: "and",
          rules: [],
        },
        onChange,
        onClose,
      }),
    );

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    const addRuleButton = buttons.find((button) => button.textContent?.trim() === "Regel");
    const addGroupButton = buttons.find((button) => button.textContent?.trim() === "Gruppe");

    act(() => {
      addRuleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      addGroupButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();

    cleanup();
  });

  it("supports continuous typing in value input without losing focus", () => {
    const StatefulHarness = () => {
      const [group, setGroup] = useState<DatabaseFilterGroup>({
        id: "root",
        op: "and",
        rules: [
          {
            id: "rule-1",
            field: "status",
            op: "is",
            value: "",
          },
        ],
      });
      return createElement(DatabaseFilterPanel, {
        attributes: [attribute],
        attributeSuggestions: suggestions,
        viewType: "table" as const,
        filterGroup: group,
        onChange: setGroup,
        onClose: vi.fn(),
      });
    };

    const { container, cleanup } = render(createElement(StatefulHarness));
    const valueInput = container.querySelector<HTMLInputElement>("input[placeholder='Wert']");
    expect(valueInput).toBeTruthy();

    act(() => {
      valueInput?.focus();
      valueInput?.dispatchEvent(new Event("focus", { bubbles: true }));
      if (valueInput) {
        valueInput.value = "abc";
      }
      valueInput?.dispatchEvent(new Event("input", { bubbles: true }));
      valueInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.querySelector(".database-block-filter-panel")).toBeTruthy();
    expect(document.activeElement).toBe(valueInput);
    expect(valueInput?.value).toBe("abc");

    cleanup();
  });
});
