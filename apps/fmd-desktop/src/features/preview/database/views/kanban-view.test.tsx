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

const numericAttribute: DatabaseAttributeMeta = {
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

const imageAttribute: DatabaseAttributeMeta = {
  key: "cover",
  label: "Cover",
  type: "image",
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

const coverRecord: DatabaseRecord = {
  ...recordA,
  fileId: "cover.md",
  filePath: "/vault/cover.md",
  relativePath: "cover.md",
  fileName: "cover.md",
  frontmatter: {
    status: "Open",
    cover: "cover.png",
    priority: 2,
  },
  normalizedFields: {
    status: {
      raw: "Open",
    },
    cover: "cover.png",
    priority: 2,
    Exam: true,
  },
};

const createDragEvent = (type: string, dataTransfer: DataTransfer) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: dataTransfer,
  });
  return event;
};

const clickElement = (target: Element | null) => {
  act(() => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const findColumnByLabel = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll<HTMLElement>(".database-kanban-column"))
    .find((column) => column.textContent?.includes(label));

const findCardByTitle = (container: HTMLElement, title: string) => {
  const titleButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-kanban-card-title"))
    .find((button) => button.textContent?.trim() === title);
  return titleButton?.closest(".database-kanban-card") as HTMLElement | null;
};

describe("DatabaseKanbanView", () => {
  it("groups records by the selected attribute", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const columns = container.querySelectorAll(".database-kanban-column");
    expect(columns.length).toBe(2);
    expect(container.textContent).toContain("Open");
    expect(container.textContent).toContain("Done");

    cleanup();
  });

  it("omits disabled group values and their cards", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        visibleGroupValues: ["Open"],
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    expect(findColumnByLabel(container, "Open")).toBeTruthy();
    expect(findColumnByLabel(container, "Done")).toBeUndefined();
    expect(findCardByTitle(container, "a")).toBeTruthy();
    expect(findCardByTitle(container, "b")).toBeNull();

    cleanup();
  });

  it("renders enabled empty group columns", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        visibleGroupValues: ["Open", "Done"],
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const doneColumn = findColumnByLabel(container, "Done");
    expect(doneColumn).toBeTruthy();
    expect(doneColumn?.querySelectorAll(".database-kanban-card").length).toBe(0);
    expect(doneColumn?.querySelector(".database-kanban-column-header span")?.textContent).toBe("0");

    cleanup();
  });

  it("calls move callback when a card is dropped into another column", () => {
    const onMoveRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord,
        onReorderRecordWithinGroup: vi.fn(),
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
    expect(onMoveRecord.mock.calls[0]?.[2]).toEqual({
      previousGroupKey: "Open",
      nextGroupKey: "Done",
    });

    cleanup();
  });

  it("falls back to internal drag session when dataTransfer payload is empty", () => {
    const onMoveRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord,
        onReorderRecordWithinGroup: vi.fn(),
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
      getData: vi.fn(() => ""),
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
    expect(onMoveRecord.mock.calls[0]?.[2]).toEqual({
      previousGroupKey: "Open",
      nextGroupKey: "Done",
    });

    cleanup();
  });

  it("marks tapped cards and source columns as active touch selection", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const sourceCard = findCardByTitle(container, "a");
    const sourceColumn = findColumnByLabel(container, "Open");

    clickElement(sourceCard);

    expect(sourceCard?.classList.contains("is-touch-selected")).toBe(true);
    expect(sourceColumn?.classList.contains("is-touch-source")).toBe(true);

    cleanup();
  });

  it("does not auto-select a card when tapping a column body without prior selection", () => {
    const onMoveRecord = vi.fn();
    const openRecordZ: DatabaseRecord = {
      ...recordA,
      fileId: "z.md",
      filePath: "/vault/z.md",
      relativePath: "z.md",
      fileName: "z.md",
      systemFields: {
        Dateiname: "z",
      },
      normalizedFields: {
        status: {
          raw: "Open",
        },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [openRecordZ, recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord,
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const openColumn = findColumnByLabel(container, "Open");
    const openBody = openColumn?.querySelector(".database-kanban-column-body") ?? null;

    clickElement(openBody);

    expect(container.querySelector(".database-kanban-card.is-touch-selected")).toBeNull();
    expect(onMoveRecord).not.toHaveBeenCalled();

    cleanup();
  });

  it("moves selected cards when tapping a target column body", () => {
    const onMoveRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord,
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const cardA = findCardByTitle(container, "a");
    const doneColumn = findColumnByLabel(container, "Done");
    const doneBody = doneColumn?.querySelector(".database-kanban-column-body") ?? null;

    clickElement(cardA);
    clickElement(doneBody);

    expect(onMoveRecord).toHaveBeenCalledTimes(1);
    expect(onMoveRecord.mock.calls[0]?.[0]?.fileId).toBe("a.md");
    expect(onMoveRecord.mock.calls[0]?.[1]).toBe("Done");
    expect(onMoveRecord.mock.calls[0]?.[2]).toEqual({
      previousGroupKey: "Open",
      nextGroupKey: "Done",
    });

    cleanup();
  });

  it("keeps the selected card when tapping the same source column body", () => {
    const onMoveRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord,
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const sourceCard = findCardByTitle(container, "a");
    const openColumn = findColumnByLabel(container, "Open");
    const openBody = openColumn?.querySelector(".database-kanban-column-body") ?? null;

    clickElement(sourceCard);
    clickElement(openBody);

    expect(onMoveRecord).not.toHaveBeenCalled();
    expect(sourceCard?.classList.contains("is-touch-selected")).toBe(true);

    cleanup();
  });

  it("moves selected cards by tapping a different column", () => {
    const onMoveRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord,
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const sourceCard = findCardByTitle(container, "a");
    const targetColumn = findColumnByLabel(container, "Done");

    clickElement(sourceCard);
    clickElement(targetColumn ?? null);

    expect(onMoveRecord).toHaveBeenCalledTimes(1);
    expect(onMoveRecord.mock.calls[0]?.[0]?.fileId).toBe("a.md");
    expect(onMoveRecord.mock.calls[0]?.[1]).toBe("Done");
    expect(onMoveRecord.mock.calls[0]?.[2]).toEqual({
      previousGroupKey: "Open",
      nextGroupKey: "Done",
    });
    expect(container.querySelector(".database-kanban-card.is-touch-selected")).toBeNull();

    cleanup();
  });

  it("clears touch source selection when tapping the same source again", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const sourceCard = findCardByTitle(container, "a");

    clickElement(sourceCard);
    expect(sourceCard?.classList.contains("is-touch-selected")).toBe(true);

    clickElement(sourceCard);
    expect(sourceCard?.classList.contains("is-touch-selected")).toBe(false);
    expect(container.querySelector(".database-kanban-column.is-touch-source")).toBeNull();

    cleanup();
  });

  it("clears touch source selection on Escape and outside pointer down", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const sourceCard = findCardByTitle(container, "a");
    clickElement(sourceCard);
    expect(container.querySelector(".database-kanban-card.is-touch-selected")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container.querySelector(".database-kanban-card.is-touch-selected")).toBeNull();

    clickElement(sourceCard);
    expect(container.querySelector(".database-kanban-card.is-touch-selected")).toBeTruthy();

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    act(() => {
      outside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(container.querySelector(".database-kanban-card.is-touch-selected")).toBeNull();
    outside.remove();

    cleanup();
  });

  it("keeps title button behavior and does not treat title clicks as touch source selection", () => {
    const onMoveRecord = vi.fn();
    const onOpenRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [recordA, recordB],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord,
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord,
      }),
    );

    const titleButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-kanban-card-title"))
      .find((button) => button.textContent?.trim() === "a");

    clickElement(titleButton ?? null);

    expect(onOpenRecord).toHaveBeenCalledTimes(1);
    expect(onOpenRecord.mock.calls[0]?.[0]?.fileId).toBe("a.md");
    expect(onMoveRecord).not.toHaveBeenCalled();
    expect(container.querySelector(".database-kanban-card.is-touch-selected")).toBeNull();

    cleanup();
  });

  it("renders cover and hover-only property meta when cover mode is enabled", () => {
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [coverRecord],
        groupAttribute,
        attributes: [groupAttribute, imageAttribute, numericAttribute],
        visibleProperties: [numericAttribute],
        showCover: true,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    expect(container.querySelector(".database-kanban-card-cover-image")).toBeTruthy();
    const hoverOnlyMeta = container.querySelector(".database-kanban-card-properties.is-hover-only");
    expect(hoverOnlyMeta).toBeTruthy();
    expect(hoverOnlyMeta?.textContent).toContain("Priority");
    expect(hoverOnlyMeta?.textContent).toContain("2");

    cleanup();
  });

  it("keeps incoming record order within the same column", () => {
    const openRecordZ: DatabaseRecord = {
      ...recordA,
      fileId: "z.md",
      filePath: "/vault/z.md",
      relativePath: "z.md",
      fileName: "z.md",
      systemFields: {
        Dateiname: "z",
      },
      normalizedFields: {
        status: {
          raw: "Open",
        },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [openRecordZ, recordA],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const openColumn = Array.from(container.querySelectorAll(".database-kanban-column"))
      .find((column) => column.textContent?.includes("Open"));
    const titles = Array.from(openColumn?.querySelectorAll(".database-kanban-card-title") ?? [])
      .map((node) => node.textContent?.trim());
    expect(titles).toEqual(["z", "a"]);

    cleanup();
  });

  it("prioritizes manual orderByGroup entries over incoming order", () => {
    const openRecordZ: DatabaseRecord = {
      ...recordA,
      fileId: "z.md",
      filePath: "/vault/z.md",
      relativePath: "z.md",
      fileName: "z.md",
      systemFields: {
        Dateiname: "z",
      },
      normalizedFields: {
        status: {
          raw: "Open",
        },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [openRecordZ, recordA],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        orderByGroup: {
          Open: ["a.md"],
        },
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
      }),
    );

    const openColumn = Array.from(container.querySelectorAll(".database-kanban-column"))
      .find((column) => column.textContent?.includes("Open"));
    const titles = Array.from(openColumn?.querySelectorAll(".database-kanban-card-title") ?? [])
      .map((node) => node.textContent?.trim());
    expect(titles).toEqual(["a", "z"]);

    cleanup();
  });

  it("triggers up/down reorder actions for cards inside a group", () => {
    const onReorderRecordWithinGroup = vi.fn();
    const openRecordZ: DatabaseRecord = {
      ...recordA,
      fileId: "z.md",
      filePath: "/vault/z.md",
      relativePath: "z.md",
      fileName: "z.md",
      systemFields: {
        Dateiname: "z",
      },
      normalizedFields: {
        status: {
          raw: "Open",
        },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [openRecordZ, recordA],
        groupAttribute,
        attributes: [groupAttribute],
        visibleProperties: [],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup,
        onOpenRecord: vi.fn(),
      }),
    );

    const orderButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".database-kanban-card-order-actions .database-block-toolbar-button"),
    );

    act(() => {
      orderButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      orderButtons[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onReorderRecordWithinGroup).toHaveBeenCalledWith("Open", "z.md", "down");
    expect(onReorderRecordWithinGroup).toHaveBeenCalledWith("Open", "a.md", "up");

    cleanup();
  });

  it("renders exam action for eligible records when Exam property is visible", () => {
    const onOpenExamFromRecord = vi.fn();
    const nonExamRecord: DatabaseRecord = {
      ...recordB,
      fileId: "c.md",
      filePath: "/vault/c.md",
      relativePath: "c.md",
      fileName: "c.md",
      normalizedFields: {
        ...recordB.normalizedFields,
        Exam: false,
      },
    };
    const { container, cleanup } = render(
      createElement(DatabaseKanbanView, {
        records: [coverRecord, nonExamRecord],
        groupAttribute,
        attributes: [groupAttribute, examAttribute],
        visibleProperties: [examAttribute],
        showCover: false,
        pendingRecordIds: [],
        onMoveRecord: vi.fn(),
        onReorderRecordWithinGroup: vi.fn(),
        onOpenRecord: vi.fn(),
        onOpenExamFromRecord,
      }),
    );

    const examButton = container.querySelector<HTMLButtonElement>(".database-exam-action");
    expect(examButton).toBeTruthy();

    act(() => {
      examButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenExamFromRecord).toHaveBeenCalledTimes(1);
    expect(onOpenExamFromRecord.mock.calls[0]?.[0]?.fileId).toBe("cover.md");

    cleanup();
  });
});
