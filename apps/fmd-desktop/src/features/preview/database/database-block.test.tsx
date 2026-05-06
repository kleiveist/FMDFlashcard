// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownHybridDatabaseBlock } from "./database-block";
import { parseDatabaseBlockConfigFromRaw } from "./database-block-parser";
import { type VaultFile } from "../../../lib/tree";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const taskFile: VaultFile = {
  path: "/vault/tasks/task-a.md",
  relative_path: "tasks/task-a.md",
};

const taskMarkdown = [
  "---",
  "unitsstart: 1",
  "units: 5",
  "StatusCode: text2",
  "progress: 50",
  "---",
  "# Task A",
].join("\n");

const render = async (element: ReactElement) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1400,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 900,
  });
  if (typeof window.requestAnimationFrame !== "function") {
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
    });
  }
  if (typeof window.cancelAnimationFrame !== "function") {
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: (handle: number) => window.clearTimeout(handle),
    });
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
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

const flushAsyncWork = async () => {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
    await Promise.resolve();
  });
};

const createSingleProjectViewRaw = () => [
  "::::",
  "title: Main",
  "source:",
  "  type: current-folder",
  "views:",
  "  activeViewId: view-main",
  "  items:",
  "    - id: view-main",
  "      name: Main",
  "      view:",
  "        type: project",
  "        projectStartField: unitsstart",
  "        projectUnitField: units",
  "        blockResolution: 1",
  "        defaultUnits: 2",
  "        projectMissingPlacement: show-unplaced",
  "      properties:",
  "        - StatusCode",
  "      filters:",
  "        op: and",
  "        rules: []",
  "      sort: []",
  "options:",
  "  editable: true",
  "  showSearch: false",
  "  showToolbar: true",
  "::::",
].join("\n");

const createTwoProjectViewsRaw = () => [
  "::::",
  "title: Main",
  "source:",
  "  type: current-folder",
  "views:",
  "  activeViewId: view-main",
  "  items:",
  "    - id: view-main",
  "      name: Main",
  "      view:",
  "        type: project",
  "        projectStartField: unitsstart",
  "        projectUnitField: units",
  "        blockResolution: 1",
  "      properties:",
  "        - StatusCode",
  "      filters:",
  "        op: and",
  "        rules: []",
  "      sort: []",
  "    - id: view-alt",
  "      name: Alt",
  "      view:",
  "        type: project",
  "        projectStartField: unitsstart",
  "        projectUnitField: units",
  "        blockResolution: 1",
  "        projectBarFillConfigs:",
  "          - recordId: tasks/task-a.md",
  "            attributeKey: StatusCode",
  "            mode: text-code",
  "            mappings:",
  "              - from: text2",
  "                to: 80",
  "      properties:",
  "        - StatusCode",
  "      filters:",
  "        op: and",
  "        rules: []",
  "      sort: []",
  "options:",
  "  editable: true",
  "  showSearch: false",
  "  showToolbar: true",
  "::::",
].join("\n");

const getLatestCommittedRaw = (onCommitRaw: ReturnType<typeof vi.fn>) => {
  const latestCall = onCommitRaw.mock.calls[onCommitRaw.mock.calls.length - 1];
  const raw = latestCall?.[0];
  if (typeof raw !== "string") {
    throw new Error("Expected a committed database block string.");
  }
  return raw;
};

const getViewButtonByText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"))
    .find((button) => (button.textContent ?? "").trim() === text);

const setSelectValue = (select: HTMLSelectElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  descriptor?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("MarkdownHybridDatabaseBlock project presentation config", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "read_text_file") {
        return taskMarkdown;
      }
      throw new Error(`Unexpected invoke command: ${command}`);
    });
  });

  it("persists resolution changes as view config without frontmatter writes", async () => {
    const onCommitRaw = vi.fn();
    const { container, cleanup } = await render(
      createElement(MarkdownHybridDatabaseBlock, {
        raw: createSingleProjectViewRaw(),
        vaultFiles: [taskFile],
        sourceRelativePath: "tasks/index.md",
        onCommitRaw,
        allowCellEditing: true,
      }),
    );
    await flushAsyncWork();

    const projectOptionsButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => (button.textContent ?? "").includes("Project Optionen"));
    act(() => {
      projectOptionsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const panel = document.querySelector<HTMLElement>(".database-block-project-panel");
    expect(panel).toBeTruthy();
    expect(panel?.textContent).not.toContain("Standard Units");
    expect(panel?.textContent).not.toContain("Ohne Placement");
    const resolutionSelect = panel?.querySelectorAll<HTMLSelectElement>("select")[2];
    expect(resolutionSelect).toBeTruthy();
    act(() => {
      if (resolutionSelect) {
        setSelectValue(resolutionSelect, "2");
      }
    });

    expect(onCommitRaw).toHaveBeenCalledTimes(1);
    const parsed = parseDatabaseBlockConfigFromRaw(getLatestCommittedRaw(onCommitRaw));
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.view.blockResolution).toBe(2);
    expect(parsed.config.views.items[0]?.view.blockResolution).toBe(2);
    expect(parsed.config.view.projectBarFillConfigs).toEqual([]);

    const commands = invokeMock.mock.calls.map((call) => call[0]);
    expect(commands.filter((command) => command !== "read_text_file")).toEqual([]);
    cleanup();
  });

  it("keeps saved project bar rules scoped to their owning view", async () => {
    const onCommitRaw = vi.fn();
    const { container, cleanup } = await render(
      createElement(MarkdownHybridDatabaseBlock, {
        raw: createTwoProjectViewsRaw(),
        vaultFiles: [taskFile],
        sourceRelativePath: "tasks/index.md",
        onCommitRaw,
        allowCellEditing: true,
      }),
    );
    await flushAsyncWork();

    const bar = container.querySelector<HTMLElement>(".database-project-bar");
    act(() => {
      bar?.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
      }));
    });

    let popup = document.querySelector<HTMLElement>(".database-project-bar-config");
    expect(popup).toBeTruthy();
    const selects = popup?.querySelectorAll<HTMLSelectElement>("select") ?? [];
    act(() => {
      if (selects[0]) {
        setSelectValue(selects[0], "StatusCode");
      }
      if (selects[1]) {
        setSelectValue(selects[1], "text-code");
      }
    });

    popup = document.querySelector<HTMLElement>(".database-project-bar-config");
    const mappingInputs = popup?.querySelectorAll<HTMLInputElement>(
      ".database-project-bar-config-mapping-row input",
    ) ?? [];
    act(() => {
      if (mappingInputs[0]) {
        setInputValue(mappingInputs[0], "text2");
      }
      if (mappingInputs[1]) {
        setInputValue(mappingInputs[1], "20");
      }
    });

    const saveButton = Array.from(popup?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((button) => (button.textContent ?? "").includes("Speichern"));
    act(() => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsyncWork();

    expect(container.querySelector<HTMLElement>(".database-project-bar-fill")?.style.width).toBe("20%");
    let parsed = parseDatabaseBlockConfigFromRaw(getLatestCommittedRaw(onCommitRaw));
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.views.items.find((view) => view.id === "view-main")?.view.projectBarFillConfigs).toEqual([
      {
        recordId: "tasks/task-a.md",
        attributeKey: "StatusCode",
        mode: "text-code",
        mappings: [{ from: "text2", to: 20 }],
      },
    ]);
    expect(parsed.config.views.items.find((view) => view.id === "view-alt")?.view.projectBarFillConfigs).toEqual([
      {
        recordId: "tasks/task-a.md",
        attributeKey: "StatusCode",
        mode: "text-code",
        mappings: [{ from: "text2", to: 80 }],
      },
    ]);

    const nameButton = container.querySelector<HTMLButtonElement>(".database-block-view-name-button");
    act(() => {
      nameButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      getViewButtonByText("Alt")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsyncWork();
    expect(container.querySelector<HTMLElement>(".database-project-bar-fill")?.style.width).toBe("80%");

    act(() => {
      nameButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      getViewButtonByText("Main")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsyncWork();
    expect(container.querySelector<HTMLElement>(".database-project-bar-fill")?.style.width).toBe("20%");

    parsed = parseDatabaseBlockConfigFromRaw(getLatestCommittedRaw(onCommitRaw));
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.views.activeViewId).toBe("view-main");
    expect(parsed.config.views.items.find((view) => view.id === "view-main")?.view.projectBarFillConfigs?.[0])
      .toMatchObject({
        recordId: "tasks/task-a.md",
        attributeKey: "StatusCode",
        mode: "text-code",
        mappings: [{ from: "text2", to: 20 }],
      });
    expect(parsed.config.views.items.find((view) => view.id === "view-alt")?.view.projectBarFillConfigs?.[0])
      .toMatchObject({
        recordId: "tasks/task-a.md",
        attributeKey: "StatusCode",
        mode: "text-code",
        mappings: [{ from: "text2", to: 80 }],
      });
    cleanup();
  });
});
