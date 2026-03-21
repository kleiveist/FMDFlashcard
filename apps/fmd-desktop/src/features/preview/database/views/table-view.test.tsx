// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseTableView } from "./table-view";
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

const compatibility = {
  supportsTable: true,
  supportsKanbanGrouping: true,
  supportsTimeline: false,
  supportsPieGrouping: true,
  supportsAggregation: false,
};

const taskAttribute: DatabaseAttributeMeta = {
  key: "Task",
  label: "Task",
  type: "text",
  origin: "frontmatter",
  formula: null,
  editable: true,
  sortable: true,
  filterable: true,
  aggregatable: false,
  viewCompatibility: compatibility,
};

const fileNameAttribute: DatabaseAttributeMeta = {
  key: "Dateiname",
  label: "Dateiname",
  type: "text",
  origin: "system",
  formula: null,
  editable: false,
  sortable: true,
  filterable: true,
  aggregatable: false,
  viewCompatibility: compatibility,
};

const record: DatabaseRecord = {
  fileId: "docs/a.md",
  filePath: "/vault/docs/a.md",
  relativePath: "docs/a.md",
  fileName: "a.md",
  folder: "docs",
  extension: "md",
  frontmatter: {
    Task: "Alpha",
  },
  systemFields: {
    Dateiname: "a",
    Dateipfad: "docs/a.md",
  },
  normalizedFields: {
    Task: "Alpha",
    Dateiname: "a",
    Dateipfad: "docs/a.md",
  },
};

describe("DatabaseTableView", () => {
  it("starts inline editing on double click for editable cells", () => {
    const onStartCellEdit = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseTableView, {
        records: [record],
        columns: [taskAttribute],
        editable: true,
        activeEditCell: null,
        pendingCellMutations: [],
        onOpenRecord: vi.fn(),
        onStartCellEdit,
        onEditCellDraftChange: vi.fn(),
        onCommitCellEdit: vi.fn(),
        onCancelCellEdit: vi.fn(),
      }),
    );

    const cell = container.querySelector(".database-table-cell");
    act(() => {
      cell?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(onStartCellEdit).toHaveBeenCalledTimes(1);
    expect(onStartCellEdit.mock.calls[0]?.[0]?.fileId).toBe(record.fileId);
    expect(onStartCellEdit.mock.calls[0]?.[1]?.key).toBe("Task");

    cleanup();
  });

  it("commits active inline edit on Enter", () => {
    const onCommitCellEdit = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseTableView, {
        records: [record],
        columns: [taskAttribute],
        editable: true,
        activeEditCell: {
          recordId: record.fileId,
          fieldKey: "Task",
          draftValue: "Alpha",
        },
        pendingCellMutations: [],
        onOpenRecord: vi.fn(),
        onStartCellEdit: vi.fn(),
        onEditCellDraftChange: vi.fn(),
        onCommitCellEdit,
        onCancelCellEdit: vi.fn(),
      }),
    );

    const input = container.querySelector<HTMLInputElement>(".database-table-cell-editor");
    act(() => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onCommitCellEdit).toHaveBeenCalledTimes(1);
    expect(onCommitCellEdit.mock.calls[0]?.[0]?.fileId).toBe(record.fileId);
    expect(onCommitCellEdit.mock.calls[0]?.[1]?.key).toBe("Task");

    cleanup();
  });

  it("opens record from filename system cell in same flow", () => {
    const onOpenRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseTableView, {
        records: [record],
        columns: [fileNameAttribute],
        editable: true,
        activeEditCell: null,
        pendingCellMutations: [],
        onOpenRecord,
        onStartCellEdit: vi.fn(),
        onEditCellDraftChange: vi.fn(),
        onCommitCellEdit: vi.fn(),
        onCancelCellEdit: vi.fn(),
      }),
    );

    const button = container.querySelector<HTMLButtonElement>(".database-table-open-record");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenRecord).toHaveBeenCalledTimes(1);
    expect(onOpenRecord.mock.calls[0]?.[0]?.fileId).toBe(record.fileId);

    cleanup();
  });
});
