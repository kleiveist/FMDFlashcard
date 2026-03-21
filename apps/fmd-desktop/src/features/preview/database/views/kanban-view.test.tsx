// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseKanbanView } from "./kanban-view";
import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
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

const groupAttribute: DatabaseAttributeMeta = {
  key: "status",
  label: "status",
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

const recordA: DatabaseRecord = {
  fileId: "a.md",
  filePath: "/vault/a.md",
  relativePath: "a.md",
  fileName: "a.md",
  folder: "",
  extension: "md",
  frontmatter: {
    status: "Open",
  },
  systemFields: {
    Dateiname: "a",
  },
  normalizedFields: {
    status: {
      raw: "Open",
    },
  },
};

const recordB: DatabaseRecord = {
  ...recordA,
  fileId: "b.md",
  filePath: "/vault/b.md",
  relativePath: "b.md",
  fileName: "b.md",
  systemFields: {
    Dateiname: "b",
  },
  normalizedFields: {
    status: {
      raw: "Done",
    },
  },
};

const createDragEvent = (type: string, dataTransfer: DataTransfer) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: dataTransfer,
  });
  return event;
};

describe("DatabaseKanbanView", () => {
  it("groups records by the selected attribute", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const columns = container.querySelectorAll(".database-kanban-column");
    expect(columns.length).toBe(2);
    expect(container.textContent).toContain("Open");
    expect(container.textContent).toContain("Done");

    cleanup();
  });

  it("calls move callback when a card is dropped into another column", () => {
    const onMoveRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        pendingRecordIds: [],
        onMoveRecord,
        onOpenRecord: vi.fn(),
      }),
    );

    const sourceCard = Array.from(container.querySelectorAll(".database-kanban-card"))
      .find((card) => card.textContent?.includes("a"));
    const targetColumn = Array.from(container.querySelectorAll(".database-kanban-column"))
      .find((column) => column.textContent?.includes("Done"));

    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(() => "a.md"),
      clearData: vi.fn(),
      files: [] as unknown as FileList,
      items: [] as unknown as DataTransferItemList,
      types: [],
      setDragImage: vi.fn(),
    } as unknown as DataTransfer;

    act(() => {
      sourceCard?.dispatchEvent(createDragEvent("dragstart", dataTransfer));
      targetColumn?.dispatchEvent(createDragEvent("dragover", dataTransfer));
      targetColumn?.dispatchEvent(createDragEvent("drop", dataTransfer));
    });

    expect(onMoveRecord).toHaveBeenCalledTimes(1);
    expect(onMoveRecord.mock.calls[0]?.[0]?.fileId).toBe("a.md");
    expect(onMoveRecord.mock.calls[0]?.[1]).toBe("Done");

    cleanup();
  });
});
