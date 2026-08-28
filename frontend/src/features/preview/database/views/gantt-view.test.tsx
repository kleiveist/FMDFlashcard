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

const examAttribute: DatabaseAttributeMeta = {
  key: "Exam",
  label: "Exam",
  type: "boolean",
  origin: "system",
  formula: null,
  editable: false,
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
    supportsKanbanGrouping: false,
    supportsTimeline: false,
    supportsPieGrouping: false,
    supportsAggregation: false,
  },
};

const teamAttribute: DatabaseAttributeMeta = {
  key: "team",
  label: "Team",
  type: "text",
  origin: "frontmatter",
  formula: null,
  editable: true,
  sortable: true,
  filterable: true,
  aggregatable: false,
  viewCompatibility: {
    supportsTable: true,
    supportsKanbanGrouping: false,
    supportsTimeline: false,
    supportsPieGrouping: false,
    supportsAggregation: false,
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
    owner: "Anna",
    team: "Core",
    Exam: true,
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

  it("keeps unscheduled tracks without placeholder hint text", () => {
    const unscheduledRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "unscheduled.md",
      filePath: "/vault/unscheduled.md",
      relativePath: "unscheduled.md",
      fileName: "unscheduled.md",
      systemFields: {
        Dateiname: "Unscheduled",
      },
      normalizedFields: {
        priority: 3,
      },
    };

    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord, unscheduledRecord],
        startAttribute,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [],
      }),
    );

    expect(container.querySelectorAll(".database-gantt-row-track").length).toBe(2);
    expect(container.querySelectorAll(".database-gantt-unscheduled-hint").length).toBe(0);

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

  it("shows sidebar toggle and collapses sidebar by reflow (no overlay)", () => {
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
    );

    const toggleButton = Array.from(container.querySelectorAll("button"))
      .find((button) => (button.textContent ?? "").includes("Datensatz"));
    expect(toggleButton).toBeTruthy();
    expect(container.querySelector(".database-gantt-sidebar-header")).toBeTruthy();

    act(() => {
      toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(".database-gantt-sidebar-header")).toBeNull();
    expect(container.querySelector(".database-gantt-sidebar-overlay")).toBeNull();

    cleanup();
  });

  it("uses the same sidebar toggle control on narrow viewport", () => {
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
      .find((button) => (button.textContent ?? "").includes("Datensatz anzeigen"));
    expect(toggleButton).toBeTruthy();
    expect(container.querySelector(".database-gantt-sidebar-header")).toBeNull();

    cleanup();
  });

  it("supports arrow-key navigation against nearest scroll host", () => {
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
    );

    Object.defineProperty(container, "scrollWidth", { configurable: true, value: 1400 });
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 640 });
    container.style.overflowX = "auto";
    const scrollBy = vi.fn();
    Object.defineProperty(container, "scrollBy", { configurable: true, value: scrollBy });

    const root = container.querySelector<HTMLElement>(".database-gantt-view");
    root?.focus();
    act(() => {
      root?.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(scrollBy).toHaveBeenCalled();

    cleanup();
  });

  it("renders selected property meta as two-row flow items in the right track area", () => {
    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord],
        startAttribute,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [numberAttribute, ownerAttribute, teamAttribute],
      }),
    );

    const meta = container.querySelector(".database-gantt-row-meta");
    expect(meta).toBeTruthy();
    expect(meta?.textContent).toContain("Priority");
    expect(meta?.textContent).toContain("2");
    expect(meta?.textContent).toContain("Owner");
    expect(meta?.textContent).toContain("Anna");
    expect(meta?.textContent).toContain("Team");
    expect(meta?.textContent).toContain("Core");
    expect(meta?.querySelectorAll(".database-row-meta-item").length).toBe(3);

    cleanup();
  });

  it("renders clickable exam action in row meta for eligible records", () => {
    const onOpenExamFromRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseGanttView, {
        records: [baseRecord],
        startAttribute,
        endAttribute,
        mode: "date",
        baseDate: null,
        zoom: "month",
        visibleProperties: [examAttribute],
        onOpenExamFromRecord,
      }),
    );

    const button = container.querySelector<HTMLButtonElement>(".database-gantt-row-meta .database-exam-action");
    expect(button).toBeTruthy();
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenExamFromRecord).toHaveBeenCalledTimes(1);
    expect(onOpenExamFromRecord.mock.calls[0]?.[0]?.fileId).toBe("a.md");

    cleanup();
  });
});
