// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseGanttView } from "./gantt-view";
import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
} from "../database-types";

const render = (element: ReactElement, viewportWidth = 1400) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: viewportWidth,
  });
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

const timelineCompatibility = {
  supportsTable: true,
  supportsKanbanGrouping: false,
  supportsTimeline: true,
  supportsPieGrouping: false,
  supportsAggregation: false,
};

const startAttribute: DatabaseAttributeMeta = {
  key: "startDate",
  label: "Start",
  type: "date",
  origin: "frontmatter",
  formula: null,
  editable: true,
  sortable: true,
  filterable: true,
  aggregatable: false,
  viewCompatibility: timelineCompatibility,
};

const endAttribute: DatabaseAttributeMeta = {
  ...startAttribute,
  key: "dueDate",
  label: "Due",
};

const numberAttribute: DatabaseAttributeMeta = {
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

const baseRecord: DatabaseRecord = {
  fileId: "a.md",
  filePath: "/vault/a.md",
  relativePath: "a.md",
  fileName: "a.md",
  folder: "",
  extension: "md",
  frontmatter: {},
  systemFields: {
    Dateiname: "A",
  },
  normalizedFields: {
    startDate: new Date("2026-01-02"),
    dueDate: new Date("2026-01-12"),
    priority: 2,
  },
};

describe("DatabaseGanttView", () => {
  it("shows empty state when no start attribute is configured", () => {
    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord],
        startAttribute: null,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [],
      }),
    );

    expect(container.textContent).toContain("Start-Zeitfeld");
    cleanup();
  });

  it("renders bars and milestones and keeps record navigation", () => {
    const onOpenRecord = vi.fn();
    const milestoneRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "b.md",
      filePath: "/vault/b.md",
      relativePath: "b.md",
      systemFields: {
        Dateiname: "B",
      },
      normalizedFields: {
        startDate: new Date("2026-01-08"),
      },
    };

    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord, milestoneRecord],
        startAttribute,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [],
        onOpenRecord,
      }),
    );

    expect(container.querySelectorAll(".database-gantt-bar").length).toBe(1);
    expect(container.querySelectorAll(".database-gantt-milestone").length).toBe(1);

    const firstTitle = container.querySelector<HTMLButtonElement>(".database-gantt-sidebar-row-title");
    act(() => {
      firstTitle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenRecord).toHaveBeenCalledTimes(1);
    expect(onOpenRecord.mock.calls[0]?.[0]?.fileId).toBe("a.md");

    cleanup();
  });

  it("uses quarter labels when gantt zoom is quarter", () => {
    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord],
        startAttribute,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "quarter",
        visibleProperties: [],
      }),
    );

    expect(container.textContent).toContain("Q1 2026");
    cleanup();
  });

  it("supports formula date fields as timeline source", () => {
    const formulaStartAttribute: DatabaseAttributeMeta = {
      ...startAttribute,
      key: "formulaStart",
      label: "Formula Start",
      origin: "formula",
    };

    const formulaRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "formula.md",
      filePath: "/vault/formula.md",
      relativePath: "formula.md",
      normalizedFields: {
        formulaStart: new Date("2026-02-05"),
      },
    };

    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [formulaRecord],
        startAttribute: formulaStartAttribute,
        endAttribute: null,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [],
      }),
    );

    expect(container.querySelectorAll(".database-gantt-milestone").length).toBe(1);
    cleanup();
  });

  it("shows mobile list toggle under narrow viewport", () => {
    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord],
        startAttribute,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [],
      }),
      1000,
    );

    const toggleButton = Array.from(container.querySelectorAll("button"))
      .find((button) => (button.textContent ?? "").includes("Liste anzeigen"));
    expect(toggleButton).toBeTruthy();
    cleanup();
  });

  it("renders selected property meta in the right track area", () => {
    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord],
        startAttribute,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [numberAttribute],
      }),
    );

    const meta = container.querySelector(".database-gantt-row-meta");
    expect(meta).toBeTruthy();
    expect(meta?.textContent).toContain("Priority");
    expect(meta?.textContent).toContain("2");

    cleanup();
  });
});
