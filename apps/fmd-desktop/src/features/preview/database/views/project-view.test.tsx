// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseProjectView } from "./project-view";
import {
  type DatabaseAttributeMeta,
  type DatabaseProjectBarFillConfig,
  type DatabaseRecord,
} from "../database-types";

const render = (element: ReactElement, viewportWidth = 1400) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: viewportWidth,
  });
  if (typeof window.PointerEvent !== "function") {
    class MockPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      isPrimary: boolean;

      constructor(type: string, init: MouseEventInit = {}) {
        super(type, init);
        this.pointerId = 1;
        this.pointerType = "mouse";
        this.isPrimary = true;
      }
    }
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MockPointerEvent,
    });
  }
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

const flushReactWork = async () => {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
};

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

const createPointerLikeEvent = (
  type: string,
  clientX: number,
  options?: { ctrlKey?: boolean; metaKey?: boolean; button?: number },
) => {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    ctrlKey: Boolean(options?.ctrlKey),
    metaKey: Boolean(options?.metaKey),
    button: options?.button ?? 0,
  });
};

const setFormControlValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement | HTMLSelectElement;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
};

const createRecord = (id: string, fields: DatabaseRecord["normalizedFields"]): DatabaseRecord => ({
  fileId: id,
  filePath: `/vault/${id}.md`,
  relativePath: `${id}.md`,
  fileName: `${id}.md`,
  folder: "",
  extension: "md",
  frontmatter: {},
  systemFields: {
    Dateiname: id,
  },
  normalizedFields: fields,
});

const placedRecord = createRecord("placed", {
  unitsstart: 3,
  units: 4,
  status: {
    raw: "Open",
  },
  owner: "Anna",
  priority: 2,
  Exam: true,
});

const unplacedRecord = createRecord("unplaced", {});

const statusAttribute: DatabaseAttributeMeta = {
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
    supportsKanbanGrouping: true,
    supportsTimeline: false,
    supportsPieGrouping: true,
    supportsAggregation: false,
  },
};

const priorityAttribute: DatabaseAttributeMeta = {
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
    supportsKanbanGrouping: true,
    supportsTimeline: false,
    supportsPieGrouping: true,
    supportsAggregation: true,
  },
};

const fillRecord = createRecord("fill", {
  unitsstart: 1,
  units: 5,
  FortschrittFormel: 11,
  StatusCode: "text2",
});

const progressFormulaAttribute: DatabaseAttributeMeta = {
  key: "FortschrittFormel",
  label: "FortschrittFormel",
  type: "formula",
  origin: "formula",
  formulaDefinition: null,
  formula: null,
  editable: false,
  sortable: true,
  filterable: true,
  aggregatable: true,
  viewCompatibility: {
    supportsTable: true,
    supportsKanbanGrouping: true,
    supportsTimeline: false,
    supportsPieGrouping: true,
    supportsAggregation: true,
  },
};

const statusCodeAttribute: DatabaseAttributeMeta = {
  key: "StatusCode",
  label: "StatusCode",
  type: "text",
  origin: "frontmatter",
  formulaDefinition: null,
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

describe("DatabaseProjectView", () => {
  it("renders existing blocks and keeps unplaced tracks without hints", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord, unplacedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
      }),
    );

    expect(container.querySelectorAll(".database-project-bar").length).toBe(1);
    expect(container.querySelectorAll(".database-project-row-track").length).toBe(2);
    expect(container.querySelectorAll(".database-project-unplaced-hint").length).toBe(0);

    cleanup();
  });

  it("creates/moves placement via drop with default units", () => {
    const onCommitPlacement = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord, unplacedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 2,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
        editable: true,
        onCommitPlacement,
      }),
    );

    const tracks = container.querySelectorAll<HTMLElement>(".database-project-row-track");
    const targetTrack = tracks[1];
    const dataTransfer = createDragDataTransfer();
    dataTransfer.setData("text/plain", "unplaced");

    act(() => {
      const drop = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
      Object.defineProperty(drop, "clientX", { value: 54 });
      targetTrack?.dispatchEvent(drop);
    });

    expect(onCommitPlacement).toHaveBeenCalledTimes(1);
    const call = onCommitPlacement.mock.calls[0]?.[0];
    expect(call?.record?.fileId).toBe("unplaced");
    expect(call?.startSlot).toBeGreaterThanOrEqual(0);
    expect(call?.units).toBe(2);

    cleanup();
  });

  it("commits block move and resize interactions", async () => {
    const onCommitPlacement = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
        editable: true,
        onCommitPlacement,
      }),
    );

    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    const endHandle = container.querySelector<HTMLElement>(".database-project-bar-handle.is-end");

    await act(async () => {
      bar?.dispatchEvent(createPointerLikeEvent("pointerdown", 100));
    });
    await flushReactWork();
    act(() => {
      window.dispatchEvent(createPointerLikeEvent("pointermove", 136));
    });
    await flushReactWork();
    act(() => {
      window.dispatchEvent(createPointerLikeEvent("pointerup", 136));
    });

    expect(onCommitPlacement).toHaveBeenCalledTimes(1);
    expect(onCommitPlacement.mock.calls[0]?.[0]?.startSlot).toBe(5);
    expect(onCommitPlacement.mock.calls[0]?.[0]?.units).toBe(4);

    await act(async () => {
      endHandle?.dispatchEvent(createPointerLikeEvent("pointerdown", 120));
    });
    await flushReactWork();
    act(() => {
      window.dispatchEvent(createPointerLikeEvent("pointermove", 138));
    });
    await flushReactWork();
    act(() => {
      window.dispatchEvent(createPointerLikeEvent("pointerup", 138));
    });

    expect(onCommitPlacement).toHaveBeenCalledTimes(2);
    expect(onCommitPlacement.mock.calls[1]?.[0]?.startSlot).toBe(3);
    expect(onCommitPlacement.mock.calls[1]?.[0]?.units).toBe(5);

    cleanup();
  });

  it("multiplies visual bars by block resolution but commits domain units", async () => {
    const resolutionTwo = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 2,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
      }),
    );

    const barAtTwo = resolutionTwo.container.querySelector<HTMLElement>(".database-project-bar");
    expect(barAtTwo?.style.left).toBe("108px");
    expect(barAtTwo?.style.width).toBe("144px");
    resolutionTwo.cleanup();

    const onCommitPlacement = vi.fn();
    const resolutionFour = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 4,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
        editable: true,
        onCommitPlacement,
      }),
    );

    const barAtFour = resolutionFour.container.querySelector<HTMLElement>(".database-project-bar");
    expect(barAtFour?.style.left).toBe("216px");
    expect(barAtFour?.style.width).toBe("288px");

    await act(async () => {
      barAtFour?.dispatchEvent(createPointerLikeEvent("pointerdown", 100));
    });
    await flushReactWork();
    act(() => {
      window.dispatchEvent(createPointerLikeEvent("pointermove", 172));
    });
    await flushReactWork();
    act(() => {
      window.dispatchEvent(createPointerLikeEvent("pointerup", 172));
    });

    expect(onCommitPlacement).toHaveBeenCalledTimes(1);
    expect(onCommitPlacement.mock.calls[0]?.[0]?.startSlot).toBe(4);
    expect(onCommitPlacement.mock.calls[0]?.[0]?.units).toBe(4);

    resolutionFour.cleanup();
  });

  it("collapses the sidebar to a catch rail and restores the timeline offset", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
      }),
    );

    const grid = container.querySelector<HTMLElement>(".database-project-grid");
    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    const toggleButton = Array.from(container.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Datensatz"),
    );
    expect(toggleButton).toBeTruthy();
    expect(container.querySelector(".database-project-sidebar-header")).toBeTruthy();
    expect(grid?.style.gridTemplateColumns).toBe("280px 1800px");
    expect(bar?.style.left).toBe("54px");
    expect(bar?.style.width).toBe("72px");

    act(() => {
      toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector(".database-project-view")?.classList.contains("is-sidebar-collapsed"),
    ).toBe(true);
    expect(container.querySelector(".database-project-sidebar-header")).toBeTruthy();
    expect(
      container.querySelector(".database-project-sidebar-row")?.classList.contains("is-collapsed"),
    ).toBe(true);
    expect(grid?.style.gridTemplateColumns).toBe("18px 1800px");
    expect(bar?.style.left).toBe("54px");
    expect(bar?.style.width).toBe("72px");

    act(() => {
      toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector(".database-project-view")?.classList.contains("is-sidebar-collapsed"),
    ).toBe(false);
    expect(grid?.style.gridTemplateColumns).toBe("280px 1800px");
    expect(bar?.style.left).toBe("54px");
    expect(bar?.style.width).toBe("72px");

    cleanup();
  });

  it("uses the same compact hidden sidebar on narrow viewport", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
      }),
      1000,
    );

    const grid = container.querySelector<HTMLElement>(".database-project-grid");
    const toggleButton = Array.from(container.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Datensatz anzeigen"),
    );
    expect(toggleButton).toBeTruthy();
    expect(
      container.querySelector(".database-project-view")?.classList.contains("is-sidebar-collapsed"),
    ).toBe(true);
    expect(container.querySelector(".database-project-sidebar-header")).toBeTruthy();
    expect(
      container.querySelector(".database-project-sidebar-row")?.classList.contains("is-collapsed"),
    ).toBe(true);
    expect(grid?.style.gridTemplateColumns).toBe("18px 1800px");

    cleanup();
  });

  it("reveals hidden sidebar rows from the left catch area and keeps drag placement available", () => {
    const onCommitPlacement = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord, unplacedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 2,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
        editable: true,
        onCommitPlacement,
      }),
    );

    const toggleButton = Array.from(container.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Datensatz"),
    );
    act(() => {
      toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const sidebarRows = container.querySelectorAll<HTMLElement>(".database-project-sidebar-row");
    const hiddenUnplacedRow = sidebarRows[1];
    expect(hiddenUnplacedRow?.classList.contains("is-collapsed")).toBe(true);
    expect(hiddenUnplacedRow?.classList.contains("is-peeking")).toBe(false);

    act(() => {
      hiddenUnplacedRow?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          clientX: 8,
        }),
      );
    });
    expect(hiddenUnplacedRow?.classList.contains("is-peeking")).toBe(true);

    act(() => {
      hiddenUnplacedRow?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
        }),
      );
    });
    expect(hiddenUnplacedRow?.classList.contains("is-peeking")).toBe(true);

    const titleButton = hiddenUnplacedRow?.querySelector<HTMLButtonElement>(
      ".database-project-sidebar-row-title",
    );
    expect(titleButton?.draggable).toBe(true);
    expect(titleButton?.tabIndex).not.toBe(-1);

    const dataTransfer = createDragDataTransfer();
    act(() => {
      const dragStart = new Event("dragstart", { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, "dataTransfer", { value: dataTransfer });
      titleButton?.dispatchEvent(dragStart);
    });

    const targetTrack = container.querySelectorAll<HTMLElement>(".database-project-row-track")[0];
    act(() => {
      const drop = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
      Object.defineProperty(drop, "clientX", { value: 54 });
      targetTrack?.dispatchEvent(drop);
    });

    expect(onCommitPlacement).toHaveBeenCalledTimes(1);
    expect(onCommitPlacement.mock.calls[0]?.[0]?.record.fileId).toBe("unplaced");
    expect(onCommitPlacement.mock.calls[0]?.[0]?.units).toBe(2);

    cleanup();
  });

  it("supports arrow-key navigation against nearest scroll host", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
      }),
    );

    const scrollHost = container.querySelector<HTMLElement>(".database-project-grid-scroll");
    expect(scrollHost).toBeTruthy();
    if (!scrollHost) {
      cleanup();
      throw new Error("Expected project grid scroll host to be rendered.");
    }

    Object.defineProperty(scrollHost, "scrollWidth", { configurable: true, value: 1200 });
    Object.defineProperty(scrollHost, "clientWidth", { configurable: true, value: 640 });
    scrollHost.style.overflowX = "auto";
    scrollHost.style.overflowY = "auto";
    const scrollBy = vi.fn();
    Object.defineProperty(scrollHost, "scrollBy", { configurable: true, value: scrollBy });

    const root = container.querySelector<HTMLElement>(".database-project-view");
    root?.focus();
    act(() => {
      root?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(scrollBy).toHaveBeenCalled();

    cleanup();
  });

  it("renders selected property meta in two-row flow items near project bars", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [statusAttribute, ownerAttribute, priorityAttribute],
      }),
    );

    const meta = container.querySelector(".database-project-row-meta");
    expect(meta).toBeTruthy();
    expect(meta?.textContent).toContain("Status");
    expect(meta?.textContent).toContain("Open");
    expect(meta?.textContent).toContain("Owner");
    expect(meta?.textContent).toContain("Anna");
    expect(meta?.textContent).toContain("Priority");
    expect(meta?.textContent).toContain("2");
    expect(meta?.querySelectorAll(".database-row-meta-item").length).toBe(3);

    cleanup();
  });

  it("renders clickable exam action in row meta for eligible records", () => {
    const onOpenExamFromRecord = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [examAttribute],
        onOpenExamFromRecord,
      }),
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".database-project-row-meta .database-exam-action",
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenExamFromRecord).toHaveBeenCalledTimes(1);
    expect(onOpenExamFromRecord.mock.calls[0]?.[0]?.fileId).toBe("placed");

    cleanup();
  });

  it("renders numeric bar fill from configured attribute and falls back to neutral on invalid range", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord],
        attributes: [progressFormulaAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        barFillConfigs: [
          {
            recordId: "fill",
            attributeKey: "FortschrittFormel",
            mode: "numeric",
            min: 0,
            max: 100,
          },
        ],
        visibleProperties: [],
      }),
    );

    const fill = container.querySelector<HTMLElement>(".database-project-bar-fill");
    expect(fill?.style.width).toBe("11%");
    expect(container.querySelector(".database-project-bar.is-neutral")).toBeNull();
    cleanup();

    const invalid = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord],
        attributes: [progressFormulaAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        barFillConfigs: [
          {
            recordId: "fill",
            attributeKey: "FortschrittFormel",
            mode: "numeric",
            min: 100,
            max: 100,
          },
        ],
        visibleProperties: [],
      }),
    );

    expect(invalid.container.querySelector(".database-project-bar.is-neutral")).toBeTruthy();
    const invalidFill = invalid.container.querySelector<HTMLElement>(".database-project-bar-fill");
    expect(invalidFill?.style.width).toBe("0%");
    invalid.cleanup();
  });

  it("renders text/code bar mapping and keeps unmatched values neutral", () => {
    const mapped = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord],
        attributes: [statusCodeAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        barFillConfigs: [
          {
            recordId: "fill",
            attributeKey: "StatusCode",
            mode: "text-code",
            mappings: [
              { from: "text1", to: 10 },
              { from: "text2", to: 20 },
              { from: "text3", to: 100 },
            ],
          },
        ],
        visibleProperties: [],
      }),
    );

    const mappedFill = mapped.container.querySelector<HTMLElement>(".database-project-bar-fill");
    expect(mappedFill?.style.width).toBe("20%");
    mapped.cleanup();

    const unmatched = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord],
        attributes: [statusCodeAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        barFillConfigs: [
          {
            recordId: "fill",
            attributeKey: "StatusCode",
            mode: "text-code",
            mappings: [{ from: "text1", to: 10 }],
          },
        ],
        visibleProperties: [],
      }),
    );

    expect(unmatched.container.querySelector(".database-project-bar.is-neutral")).toBeTruthy();
    unmatched.cleanup();
  });

  it("opens bar config on cmd/ctrl click even when drag editing is disabled", () => {
    const onChangeBarFillConfig = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord],
        attributes: [statusCodeAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
        editable: false,
        onChangeBarFillConfig,
      }),
    );

    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    act(() => {
      bar?.dispatchEvent(createPointerLikeEvent("pointerdown", 64, { metaKey: true }));
    });

    expect(document.querySelector(".database-project-bar-config")).toBeTruthy();
    cleanup();
  });

  it("opens bar config on ctrl click and persists text/code mapping", () => {
    const onChangeBarFillConfig = vi.fn();
    const onCommitPlacement = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord],
        attributes: [statusCodeAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
        editable: true,
        onChangeBarFillConfig,
        onCommitPlacement,
      }),
    );

    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    act(() => {
      bar?.dispatchEvent(createPointerLikeEvent("pointerdown", 64, { ctrlKey: true }));
    });

    const popup = document.querySelector<HTMLElement>(".database-project-bar-config");
    expect(popup).toBeTruthy();
    const selects = popup?.querySelectorAll("select") ?? [];
    const modeSelect = selects[1] as HTMLSelectElement | undefined;
    act(() => {
      if (!modeSelect) {
        return;
      }
      setFormControlValue(modeSelect, "text-code");
      modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const updatedPopup = document.querySelector<HTMLElement>(".database-project-bar-config");
    const mappingInputs =
      updatedPopup?.querySelectorAll<HTMLInputElement>(
        ".database-project-bar-config-mapping-row input",
      ) ?? [];
    act(() => {
      const source = mappingInputs[0];
      const target = mappingInputs[1];
      if (source) {
        setFormControlValue(source, "text2");
        source.dispatchEvent(new Event("input", { bubbles: true }));
        source.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (target) {
        setFormControlValue(target, "20");
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const saveButton = Array.from(updatedPopup?.querySelectorAll("button") ?? []).find((button) =>
      (button.textContent ?? "").includes("Speichern"),
    );
    act(() => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCommitPlacement).not.toHaveBeenCalled();
    expect(onChangeBarFillConfig).toHaveBeenCalledTimes(1);
    expect(onChangeBarFillConfig.mock.calls[0]?.[0]).toBe("fill");
    expect(onChangeBarFillConfig.mock.calls[0]?.[1]).toMatchObject({
      recordId: "fill",
      attributeKey: "StatusCode",
      mode: "text-code",
      mappings: [{ from: "text2", to: 20 }],
    });
    expect(document.querySelector(".database-project-bar-config")).toBeNull();

    cleanup();
  });

  it("opens bar config on right click without starting placement edits", () => {
    const onChangeBarFillConfig = vi.fn();
    const onCommitPlacement = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord],
        attributes: [statusCodeAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        visibleProperties: [],
        editable: true,
        onChangeBarFillConfig,
        onCommitPlacement,
      }),
    );

    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    act(() => {
      bar?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
        }),
      );
    });

    expect(document.querySelector(".database-project-bar-config")).toBeTruthy();
    expect(onCommitPlacement).not.toHaveBeenCalled();
    cleanup();
  });

  it("applies the active bar rule only to currently visible project records", async () => {
    const onChangeBarFillConfig = vi.fn();
    const onApplyBarFillConfigToVisible = vi.fn(
      async (_config: DatabaseProjectBarFillConfig, _records: DatabaseRecord[]) => undefined,
    );
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [fillRecord, unplacedRecord],
        attributes: [statusCodeAttribute],
        startField: "unitsstart",
        unitField: "units",
        resolution: 1,
        defaultUnits: 1,
        missingPlacement: "hide-unplaced",
        barFillConfigs: [
          {
            recordId: "fill",
            attributeKey: "StatusCode",
            mode: "text-code",
            mappings: [{ from: "text3", to: 100 }],
          },
        ],
        visibleProperties: [],
        onChangeBarFillConfig,
        onApplyBarFillConfigToVisible,
      }),
    );

    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    act(() => {
      bar?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
        }),
      );
    });
    await flushReactWork();
    await flushReactWork();

    const popup = document.querySelector<HTMLElement>(".database-project-bar-config");
    expect(popup).toBeTruthy();
    const applyButton = Array.from(popup?.querySelectorAll("button") ?? []).find((button) =>
      (button.textContent ?? "").includes("Regel auf sichtbare anwenden"),
    );
    expect(applyButton).toBeTruthy();
    await act(async () => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onApplyBarFillConfigToVisible).toHaveBeenCalledTimes(1);
    const applyCall = onApplyBarFillConfigToVisible.mock.calls[0];
    expect(applyCall).toBeDefined();
    if (!applyCall) {
      throw new Error("Expected project rule apply call.");
    }
    expect(applyCall[0]).toMatchObject({
      recordId: "fill",
      attributeKey: "StatusCode",
      mode: "text-code",
      mappings: [{ from: "text3", to: 100 }],
    });
    expect(applyCall[1].map((entry) => entry.fileId)).toEqual(["fill"]);

    cleanup();
  });
});
