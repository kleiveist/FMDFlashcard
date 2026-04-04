// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseProjectView } from "./project-view";
import { type DatabaseRecord } from "../database-types";

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

const createRecord = (
  id: string,
  fields: DatabaseRecord["normalizedFields"],
): DatabaseRecord => ({
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
  projectStart: 3,
  units: 4,
});

const unplacedRecord = createRecord("unplaced", {});

describe("DatabaseProjectView", () => {
  it("renders existing blocks and unplaced hints", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord, unplacedRecord],
        startField: "projectStart",
        unitField: "units",
        resolution: 100,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
      }),
    );

    expect(container.querySelectorAll(".database-project-bar").length).toBe(1);
    expect(container.querySelectorAll(".database-project-unplaced-hint").length).toBe(1);

    cleanup();
  });

  it("creates/moves placement via drop with default units", () => {
    const onCommitPlacement = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord, unplacedRecord],
        startField: "projectStart",
        unitField: "units",
        resolution: 100,
        defaultUnits: 2,
        missingPlacement: "show-unplaced",
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

  it("commits block move and resize interactions", () => {
    const onCommitPlacement = vi.fn();
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "projectStart",
        unitField: "units",
        resolution: 100,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
        editable: true,
        onCommitPlacement,
      }),
    );

    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    const endHandle = container.querySelector<HTMLElement>(".database-project-bar-handle.is-end");

    act(() => {
      bar?.dispatchEvent(createPointerLikeEvent("pointerdown", 100));
      window.dispatchEvent(createPointerLikeEvent("pointermove", 136));
      window.dispatchEvent(createPointerLikeEvent("pointerup", 136));
    });

    expect(onCommitPlacement).toHaveBeenCalledTimes(1);
    expect(onCommitPlacement.mock.calls[0]?.[0]?.startSlot).toBe(5);
    expect(onCommitPlacement.mock.calls[0]?.[0]?.units).toBe(4);

    act(() => {
      endHandle?.dispatchEvent(createPointerLikeEvent("pointerdown", 120));
      window.dispatchEvent(createPointerLikeEvent("pointermove", 138));
      window.dispatchEvent(createPointerLikeEvent("pointerup", 138));
    });

    expect(onCommitPlacement).toHaveBeenCalledTimes(2);
    expect(onCommitPlacement.mock.calls[1]?.[0]?.startSlot).toBe(3);
    expect(onCommitPlacement.mock.calls[1]?.[0]?.units).toBe(5);

    cleanup();
  });

  it("shows mobile list toggle under narrow viewport", () => {
    const { container, cleanup } = render(
      createElement(DatabaseProjectView, {
        records: [placedRecord],
        startField: "projectStart",
        unitField: "units",
        resolution: 100,
        defaultUnits: 1,
        missingPlacement: "show-unplaced",
      }),
      1000,
    );

    const toggleButton = Array.from(container.querySelectorAll("button"))
      .find((button) => (button.textContent ?? "").includes("Liste anzeigen"));
    expect(toggleButton).toBeTruthy();

    cleanup();
  });
});
