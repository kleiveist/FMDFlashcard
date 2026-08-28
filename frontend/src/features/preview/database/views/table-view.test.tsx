// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseTableView } from "./table-view";
import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
  type DatabaseSortRule,
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

const statusAttribute: DatabaseAttributeMeta = {
  key: "Status",
  label: "Status",
  type: "status",
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
  viewCompatibility: compatibility,
};

const formulaAttribute: DatabaseAttributeMeta = {
  key: "f-%",
  label: "f-%",
  type: "formula",
  origin: "frontmatter",
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
    Exam: false,
  },
};

const buildRecord = (index: number): DatabaseRecord => ({
  ...record,
  fileId: `docs/a-${index}.md`,
  filePath: `/vault/docs/a-${index}.md`,
  relativePath: `docs/a-${index}.md`,
  fileName: `a-${index}.md`,
});

const createDragDataTransfer = () => {
  const values = new Map<string, string>();
  return {
    effectAllowed: "all",
    dropEffect: "none",
    setData: (type: string, value: string) => {
      values.set(type, value);
    },
    getData: (type: string) => values.get(type) ?? "",
  };
};

const createPointerLikeEvent = (type: string, clientX: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: clientX });
  return event;
};

const buildProps = (overrides: Partial<ComponentProps<typeof DatabaseTableView>> = {}) => ({
  records: [record],
  columns: [taskAttribute],
  sortRules: [] as DatabaseSortRule[],
  editable: true,
  activeEditCell: null,
  pendingCellMutations: [],
  onOpenRecord: vi.fn(),
  onToggleColumnSort: vi.fn(),
  onReorderColumns: vi.fn(),
  onStartCellEdit: vi.fn(),
  onEditCellDraftChange: vi.fn(),
  onCommitCellEdit: vi.fn(),
  onBulkCommitCellEdit: vi.fn(async () => ({ updated: 0, failed: 0, failedRecordIds: [] })),
  onCancelCellEdit: vi.fn(),
  ...overrides,
});

describe("DatabaseTableView", () => {
  it("starts inline editing on double click for editable cells", () => {
    const onStartCellEdit = vi.fn();
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      onStartCellEdit,
    })));

    const cell = container.querySelector(".database-table-cell");
    act(() => {
      cell?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(onStartCellEdit).toHaveBeenCalledTimes(1);
    expect(onStartCellEdit.mock.calls[0]?.[0]?.fileId).toBe(record.fileId);
    expect(onStartCellEdit.mock.calls[0]?.[1]?.key).toBe("Task");

    cleanup();
  });

  it("does not start inline editing when table editing is disabled", () => {
    const onStartCellEdit = vi.fn();
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      editable: false,
      onStartCellEdit,
    })));

    const cell = container.querySelector(".database-table-cell");
    act(() => {
      cell?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(onStartCellEdit).not.toHaveBeenCalled();

    cleanup();
  });

  it("marks f-formula cells as inert and blocks inline editing on double click", () => {
    const onStartCellEdit = vi.fn();
    const formulaRecord: DatabaseRecord = {
      ...record,
      frontmatter: {
        ...record.frontmatter,
        "f-%": 20,
      },
      normalizedFields: {
        ...record.normalizedFields,
        "f-%": 20,
      },
    };
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      columns: [formulaAttribute],
      records: [formulaRecord],
      onStartCellEdit,
    })));

    const cell = container.querySelector<HTMLElement>(".database-table-cell");
    expect(cell?.classList.contains("is-inert")).toBe(true);
    expect(cell?.getAttribute("aria-readonly")).toBe("true");

    act(() => {
      cell?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(onStartCellEdit).not.toHaveBeenCalled();

    cleanup();
  });

  it("commits active inline edit on Enter", () => {
    const onCommitCellEdit = vi.fn();
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      activeEditCell: {
        recordId: record.fileId,
        fieldKey: "Task",
        draftValue: "Alpha",
      },
      onCommitCellEdit,
    })));

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
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      columns: [fileNameAttribute],
      onOpenRecord,
    })));

    const button = container.querySelector<HTMLButtonElement>(".database-table-open-record");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenRecord).toHaveBeenCalledTimes(1);
    expect(onOpenRecord.mock.calls[0]?.[0]?.fileId).toBe(record.fileId);

    cleanup();
  });

  it("toggles column sort when clicking a header cell", () => {
    const onToggleColumnSort = vi.fn();
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      onToggleColumnSort,
    })));

    const headerButton = container.querySelector<HTMLButtonElement>(".database-table-header-button");
    act(() => {
      headerButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggleColumnSort).toHaveBeenCalledTimes(1);
    expect(onToggleColumnSort).toHaveBeenCalledWith("Task");

    cleanup();
  });

  it("reorders columns via header drag and drop", () => {
    const onReorderColumns = vi.fn();
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      columns: [taskAttribute, fileNameAttribute],
      onReorderColumns,
    })));

    const headerCells = container.querySelectorAll<HTMLDivElement>(".database-table-header-cell");
    const source = headerCells[0];
    const target = headerCells[1];
    const dataTransfer = createDragDataTransfer();

    act(() => {
      const dragStart = new Event("dragstart", { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, "dataTransfer", { value: dataTransfer });
      source?.dispatchEvent(dragStart);

      const dragOver = new Event("dragover", { bubbles: true, cancelable: true });
      Object.defineProperty(dragOver, "dataTransfer", { value: dataTransfer });
      target?.dispatchEvent(dragOver);

      const drop = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
      target?.dispatchEvent(drop);
    });

    expect(onReorderColumns).toHaveBeenCalledTimes(1);
    expect(onReorderColumns).toHaveBeenCalledWith("Task", "Dateiname");

    cleanup();
  });

  it("resizes columns from the header resize handle", () => {
    const onResizeColumn = vi.fn();
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      columns: [taskAttribute, fileNameAttribute],
      columnWidths: {
        Task: 180,
        Dateiname: 180,
      },
      onResizeColumn,
    })));

    const resizeHandle = container.querySelector<HTMLButtonElement>(".database-table-column-resize-handle");
    expect(resizeHandle).toBeTruthy();

    act(() => {
      resizeHandle?.dispatchEvent(createPointerLikeEvent("pointerdown", 200));
      window.dispatchEvent(createPointerLikeEvent("pointermove", 240));
      window.dispatchEvent(createPointerLikeEvent("pointerup", 240));
    });

    expect(onResizeColumn).toHaveBeenCalledTimes(1);
    expect(onResizeColumn).toHaveBeenCalledWith("Task", 220);
    const headerRow = container.querySelector<HTMLElement>(".database-table-header-row");
    expect(headerRow?.style.gridTemplateColumns).toContain("220px");

    cleanup();
  });

  it("uses a max viewport of 50 visible rows", () => {
    const records = Array.from({ length: 60 }, (_, index) => buildRecord(index));
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      records,
    })));

    const scroll = container.querySelector<HTMLDivElement>(".database-table-scroll");
    expect(scroll?.style.maxHeight).toBe(`${50 * 34}px`);

    cleanup();
  });

  it("renders exam action only for eligible exam rows", () => {
    const onOpenExamFromRecord = vi.fn();
    const examRecord: DatabaseRecord = {
      ...record,
      fileId: "docs/exam.md",
      filePath: "/vault/docs/exam.md",
      relativePath: "docs/exam.md",
      fileName: "exam.md",
      systemFields: {
        ...record.systemFields,
        Dateiname: "exam",
        Dateipfad: "docs/exam.md",
        Exam: true,
      },
      normalizedFields: {
        ...record.normalizedFields,
        Dateiname: "exam",
        Dateipfad: "docs/exam.md",
        Exam: true,
      },
    };
    const nonExamRecord: DatabaseRecord = {
      ...record,
      fileId: "docs/no-exam.md",
      filePath: "/vault/docs/no-exam.md",
      relativePath: "docs/no-exam.md",
      fileName: "no-exam.md",
      systemFields: {
        ...record.systemFields,
        Dateiname: "no-exam",
        Dateipfad: "docs/no-exam.md",
        Exam: false,
      },
      normalizedFields: {
        ...record.normalizedFields,
        Dateiname: "no-exam",
        Dateipfad: "docs/no-exam.md",
        Exam: false,
      },
    };
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      columns: [fileNameAttribute, examAttribute],
      records: [examRecord, nonExamRecord],
      onOpenExamFromRecord,
    })));

    const examButtons = container.querySelectorAll<HTMLButtonElement>(".database-exam-action");
    expect(examButtons).toHaveLength(1);
    expect(container.querySelectorAll(".database-cell-empty").length).toBeGreaterThan(0);

    act(() => {
      examButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenExamFromRecord).toHaveBeenCalledTimes(1);
    expect(onOpenExamFromRecord.mock.calls[0]?.[0]?.fileId).toBe("docs/exam.md");

    cleanup();
  });

  it("bulk edits selected cells in one column", async () => {
    const firstRecord = buildRecord(1);
    const secondRecord = buildRecord(2);
    const onBulkCommitCellEdit = vi.fn(async (
      _records: DatabaseRecord[],
      _column: DatabaseAttributeMeta,
      _draftValue: string | boolean,
    ) => ({
      updated: 2,
      failed: 0,
      failedRecordIds: [],
    }));
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      records: [firstRecord, secondRecord],
      onBulkCommitCellEdit,
    })));

    expect(container.querySelector(".database-table-cell-select")).toBeNull();
    const cells = container.querySelectorAll<HTMLElement>(".database-table-cell");
    expect(cells).toHaveLength(2);

    await act(async () => {
      cells[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      cells[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    });
    expect(cells[0]?.getAttribute("aria-selected")).toBe("true");
    expect(cells[1]?.getAttribute("aria-selected")).toBe("true");

    const bulkEditor = container.querySelector<HTMLInputElement>(".database-table-bulk-editor");
    expect(bulkEditor).toBeTruthy();
    await act(async () => {
      if (bulkEditor) {
        bulkEditor.value = "Shared";
        bulkEditor.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const applyButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-table-bulk-edit button"))
      .find((button) => button.textContent?.includes("Anwenden"));
    await act(async () => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onBulkCommitCellEdit).toHaveBeenCalledTimes(1);
    const bulkCall = onBulkCommitCellEdit.mock.calls[0];
    expect(bulkCall).toBeDefined();
    if (!bulkCall) {
      throw new Error("Expected bulk edit call.");
    }
    expect(bulkCall[0].map((entry) => entry.fileId)).toEqual([
      firstRecord.fileId,
      secondRecord.fileId,
    ]);
    expect(bulkCall[1].key).toBe("Task");
    expect(bulkCall[2]).toBe("Shared");
    expect(container.querySelector(".database-table-bulk-edit")).toBeNull();

    cleanup();
  });

  it("keeps failed bulk edit cells selected", async () => {
    const firstRecord = buildRecord(1);
    const secondRecord = buildRecord(2);
    const onBulkCommitCellEdit = vi.fn(async () => ({
      updated: 1,
      failed: 1,
      failedRecordIds: [secondRecord.fileId],
    }));
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      records: [firstRecord, secondRecord],
      onBulkCommitCellEdit,
    })));

    const cells = container.querySelectorAll<HTMLElement>(".database-table-cell");
    await act(async () => {
      cells[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      cells[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    });
    const bulkEditor = container.querySelector<HTMLInputElement>(".database-table-bulk-editor");
    await act(async () => {
      if (bulkEditor) {
        bulkEditor.value = "Shared";
        bulkEditor.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const applyButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-table-bulk-edit button"))
      .find((button) => button.textContent?.includes("Anwenden"));

    await act(async () => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const nextCells = container.querySelectorAll<HTMLElement>(".database-table-cell");
    expect(nextCells[0]?.getAttribute("aria-selected")).toBeNull();
    expect(nextCells[1]?.getAttribute("aria-selected")).toBe("true");

    cleanup();
  });

  it("selects a contiguous cell range with shift click", async () => {
    const firstRecord = buildRecord(1);
    const secondRecord = buildRecord(2);
    const thirdRecord = buildRecord(3);
    const onBulkCommitCellEdit = vi.fn(async (
      _records: DatabaseRecord[],
      _column: DatabaseAttributeMeta,
      _draftValue: string | boolean,
    ) => ({
      updated: 3,
      failed: 0,
      failedRecordIds: [],
    }));
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      records: [firstRecord, secondRecord, thirdRecord],
      onBulkCommitCellEdit,
    })));

    const cells = container.querySelectorAll<HTMLElement>(".database-table-cell");
    await act(async () => {
      cells[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      cells[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    });

    expect(Array.from(cells).map((cell) => cell.getAttribute("aria-selected"))).toEqual([
      "true",
      "true",
      "true",
    ]);
    const bulkEditor = container.querySelector<HTMLInputElement>(".database-table-bulk-editor");
    await act(async () => {
      if (bulkEditor) {
        bulkEditor.value = "Range";
        bulkEditor.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const applyButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-table-bulk-edit button"))
      .find((button) => button.textContent?.includes("Anwenden"));

    await act(async () => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onBulkCommitCellEdit).toHaveBeenCalledTimes(1);
    const bulkCall = onBulkCommitCellEdit.mock.calls[0];
    expect(bulkCall).toBeDefined();
    if (!bulkCall) {
      throw new Error("Expected range bulk edit call.");
    }
    expect(bulkCall[0].map((entry) => entry.fileId)).toEqual([
      firstRecord.fileId,
      secondRecord.fileId,
      thirdRecord.fileId,
    ]);
    expect(bulkCall[2]).toBe("Range");

    cleanup();
  });

  it("resets bulk selection when selecting another column", () => {
    const firstRecord: DatabaseRecord = {
      ...buildRecord(1),
      frontmatter: {
        Task: "Alpha",
        Status: "Open",
      },
      normalizedFields: {
        ...record.normalizedFields,
        Task: "Alpha",
        Status: {
          raw: "Open",
        },
      },
    };
    const secondRecord: DatabaseRecord = {
      ...buildRecord(2),
      frontmatter: {
        Task: "Beta",
        Status: "Done",
      },
      normalizedFields: {
        ...record.normalizedFields,
        Task: "Beta",
        Status: {
          raw: "Done",
        },
      },
    };
    const { container, cleanup } = render(createElement(DatabaseTableView, buildProps({
      records: [firstRecord, secondRecord],
      columns: [taskAttribute, statusAttribute],
    })));

    const cells = container.querySelectorAll<HTMLElement>(".database-table-cell");
    act(() => {
      cells[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      cells[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(cells[0]?.getAttribute("aria-selected")).toBeNull();
    expect(cells[1]?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(".database-table-bulk-edit")?.textContent).toContain("Status");

    cleanup();
  });
});
