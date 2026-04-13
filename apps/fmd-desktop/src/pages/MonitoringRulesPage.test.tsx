// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { MonitoringRulesPage } from "./MonitoringRulesPage";
import { useAppState } from "../components/AppStateProvider";

vi.mock("../components/AppStateProvider", () => ({
  useAppState: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../components/ModalShell", async () => {
  const ReactModule = await import("react");

  return {
    ModalShell: ({
      isOpen,
      title,
      onClose,
      children,
    }: {
      isOpen: boolean;
      title: string;
      onClose: () => void;
      children: React.ReactNode;
    }) => {
      ReactModule.useEffect(() => {
        if (!isOpen) {
          return;
        }
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            onClose();
          }
        };
        window.addEventListener("keydown", handleEscape);
        return () => {
          window.removeEventListener("keydown", handleEscape);
        };
      }, [isOpen, onClose]);

      if (!isOpen) {
        return null;
      }

      return ReactModule.createElement(
        "div",
        {
          "data-testid": "mock-modal-backdrop",
          onMouseDown: () => onClose(),
        },
        ReactModule.createElement(
          "div",
          {
            "data-testid": "mock-modal-panel",
            role: "dialog",
            "aria-label": title,
            onMouseDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
          },
          ReactModule.createElement(
            "button",
            {
              type: "button",
              "aria-label": "Close",
              onClick: () => onClose(),
            },
            "close",
          ),
          children,
        ),
      );
    },
  };
});

const mockUseAppState = vi.mocked(useAppState);
const mockInvoke = vi.mocked(invoke);

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const click = async (element: Element | null) => {
  expect(element).toBeTruthy();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const mouseDown = async (element: Element | null) => {
  expect(element).toBeTruthy();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  });
};

const changeSelect = async (element: HTMLSelectElement | null, value: string) => {
  expect(element).toBeTruthy();
  await act(async () => {
    if (!element) {
      return;
    }
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const changeTextarea = async (element: HTMLTextAreaElement | null, value: string) => {
  expect(element).toBeTruthy();
  await act(async () => {
    if (!element) {
      return;
    }
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const changeInput = async (element: HTMLInputElement | null, value: string) => {
  expect(element).toBeTruthy();
  await act(async () => {
    if (!element) {
      return;
    }
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const dispatchEscape = async () => {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
};

const renderPage = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(MonitoringRulesPage));
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

const buildFormulaMarkdown = ({
  key = "f-score",
  operation = "count",
}: {
  key?: string;
  operation?: "count" | "sum" | "avg" | "group_count";
}) =>
  [
    "---",
    "score: 42",
    `${key}:`,
    "  version: 1",
    `  operation: ${operation}`,
    "  attributeKeys:",
    "    - score",
    "  source:",
    "    type: current-folder",
    "  shortTextRule:",
    "    maxChars: 32",
    "    maxTokens: 3",
    "    requireSingleNumericCore: true",
    "---",
    "# Demo",
  ].join("\n");

describe("MonitoringRulesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockInvoke.mockResolvedValue("");
    mockUseAppState.mockReturnValue({
      settings: {
        monitoringRenderProfiles: [
          {
            id: "monitoring-status",
            name: "Status",
            attributeAliases: ["status", "percent"],
            inputFormat: "code",
            previewRawValue: "2",
            scopes: ["monitoring-page", "database", "properties"],
            enabled: true,
            rules: [
              {
                id: "rule-status-map",
                type: "value-map",
                mappings: [
                  { from: "2", to: "🟢" },
                  { from: "3", to: "🟡" },
                ],
                displayMode: "append",
                separator: " ",
              },
            ],
          },
        ],
        setMonitoringRenderProfiles: vi.fn(),
        persistSettings: vi.fn(async () => true),
      },
      vault: {
        vaultPath: null,
        files: [],
      },
    } as unknown as ReturnType<typeof useAppState>);
  });

  it("renders rules as compact buttons and keeps detail closed initially", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    expect(container.querySelectorAll(".monitoring-rules-rule-card")).toHaveLength(0);
    const buttons = container.querySelectorAll(".monitoring-rules-rule-button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("Regel 1 Value Map");
    expect(buttons[0]?.textContent).toContain("->");

    cleanup();
  });

  it("renders remove action in rule list and keeps last rule removal disabled", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    const removeButtons = container.querySelectorAll<HTMLButtonElement>(
      ".monitoring-rules-rule-remove-button",
    );
    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0]?.disabled).toBe(true);

    cleanup();
  });

  it("opens and closes rule editor modal via close, escape and outside click", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(container.querySelector(".monitoring-rules-rule-button"));
    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeTruthy();

    await click(container.querySelector("[data-testid='mock-modal-panel'] button[aria-label='Close']"));
    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeNull();

    await click(container.querySelector(".monitoring-rules-rule-button"));
    await dispatchEscape();
    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeNull();

    await click(container.querySelector(".monitoring-rules-rule-button"));
    await mouseDown(container.querySelector("[data-testid='mock-modal-backdrop']"));
    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeNull();

    cleanup();
  });

  it("adds a rule and opens the newly created rule in modal", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Regel hinzufuegen",
      ) ?? null,
    );

    const ruleButtons = container.querySelectorAll(".monitoring-rules-rule-button");
    expect(ruleButtons).toHaveLength(2);
    expect(ruleButtons[1]?.textContent).toContain("Regel 2");
    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeTruthy();

    cleanup();
  });

  it("removes a rule from list without opening the modal", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Regel hinzufuegen",
      ) ?? null,
    );
    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeTruthy();

    await click(container.querySelector("[data-testid='mock-modal-panel'] button[aria-label='Close']"));
    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeNull();

    const removeButtonsBefore = container.querySelectorAll<HTMLButtonElement>(
      ".monitoring-rules-rule-remove-button",
    );
    expect(removeButtonsBefore).toHaveLength(2);
    expect(removeButtonsBefore[0]?.disabled).toBe(false);

    await click(removeButtonsBefore[0] ?? null);
    await flush();

    expect(container.querySelector("[data-testid='mock-modal-panel']")).toBeNull();
    const ruleButtons = container.querySelectorAll(".monitoring-rules-rule-button");
    expect(ruleButtons).toHaveLength(1);
    expect(ruleButtons[0]?.textContent ?? "").toContain("Regel 1");
    const remainingRemove = container.querySelector<HTMLButtonElement>(
      ".monitoring-rules-rule-remove-button",
    );
    expect(remainingRemove?.disabled).toBe(true);

    cleanup();
  });

  it("updates the rule button label live when rule details change", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(container.querySelector(".monitoring-rules-rule-button"));

    const modalPanel = container.querySelector("[data-testid='mock-modal-panel']");
    expect(modalPanel).toBeTruthy();

    await changeSelect(
      modalPanel?.querySelector<HTMLSelectElement>(".monitoring-rules-rule-head select") ?? null,
      "threshold-symbol",
    );

    await changeTextarea(
      modalPanel?.querySelector<HTMLTextAreaElement>("textarea") ?? null,
      ">= 80 ⭐",
    );

    const firstButtonText = container.querySelector(".monitoring-rules-rule-button")?.textContent ?? "";
    expect(firstButtonText).toContain("Regel 1 Threshold Symbol");
    expect(firstButtonText).not.toContain("[");

    cleanup();
  });

  it("uses unified progress visual type and exposes style variants", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(container.querySelector(".monitoring-rules-rule-button"));
    const modalPanel = container.querySelector("[data-testid='mock-modal-panel']");
    const typeSelect = modalPanel?.querySelector<HTMLSelectElement>(
      ".monitoring-rules-rule-head select",
    );
    expect(typeSelect).toBeTruthy();
    const typeOptions = Array.from(typeSelect?.options ?? [], (option) => option.textContent ?? "");
    expect(typeOptions).toContain("Progress Visual");
    expect(typeOptions).not.toContain("Progress Bar");
    expect(typeOptions).not.toContain("Progress Ring");

    await changeSelect(typeSelect ?? null, "progress-visual");

    const visualStyleSelect = modalPanel?.querySelector<HTMLSelectElement>(
      ".monitoring-rules-rule-fields select",
    );
    expect(visualStyleSelect).toBeTruthy();
    const styleValues = Array.from(visualStyleSelect?.options ?? [], (option) => option.value);
    expect(styleValues).toEqual(["bar", "ring", "pie"]);

    cleanup();
  });

  it("renders ring/pie in modal preview and mini graphic preview in rule buttons", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(container.querySelector(".monitoring-rules-rule-button"));
    const modalPanel = container.querySelector("[data-testid='mock-modal-panel']");
    await changeSelect(
      modalPanel?.querySelector<HTMLSelectElement>(".monitoring-rules-rule-head select") ?? null,
      "progress-visual",
    );
    const visualStyleSelect = modalPanel?.querySelector<HTMLSelectElement>(
      ".monitoring-rules-rule-fields--progress-visual select",
    );
    await changeSelect(visualStyleSelect ?? null, "ring");
    expect(
      modalPanel?.querySelector(".monitoring-rules-rule-preview-value .monitoring-render-ring"),
    ).toBeTruthy();

    await changeSelect(visualStyleSelect ?? null, "pie");
    expect(
      modalPanel?.querySelector(".monitoring-rules-rule-preview-value .monitoring-render-pie"),
    ).toBeTruthy();

    await click(container.querySelector("[data-testid='mock-modal-panel'] button[aria-label='Close']"));

    expect(
      container.querySelector(
        ".monitoring-rules-rule-button-indicator .monitoring-render-pie.is-compact",
      ),
    ).toBeTruthy();

    cleanup();
  });

  it("renders split preview layout with raw value control only in modal", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(container.querySelector(".monitoring-rules-rule-button"));
    const modalPanel = container.querySelector("[data-testid='mock-modal-panel']");
    expect(modalPanel?.querySelector(".monitoring-rules-rule-preview-layout")).toBeTruthy();
    expect(
      modalPanel?.querySelector<HTMLSelectElement>(".monitoring-rules-rule-preview-alias"),
    ).toBeNull();
    expect(
      modalPanel?.querySelector<HTMLInputElement>(".monitoring-rules-rule-preview-raw"),
    ).toBeTruthy();

    cleanup();
  });

  it("updates only the targeted rule raw value and button preview", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Regel hinzufuegen",
      ) ?? null,
    );
    await click(container.querySelector("[data-testid='mock-modal-panel'] button[aria-label='Close']"));

    const ruleButtonsBefore = container.querySelectorAll(".monitoring-rules-rule-button");
    expect(ruleButtonsBefore).toHaveLength(2);
    expect(ruleButtonsBefore[0]?.textContent ?? "").toContain("2");
    expect(ruleButtonsBefore[1]?.textContent ?? "").toContain("2");

    await click(ruleButtonsBefore[0] ?? null);
    const modalPanel = container.querySelector("[data-testid='mock-modal-panel']");
    await changeInput(
      modalPanel?.querySelector<HTMLInputElement>(".monitoring-rules-rule-preview-raw") ?? null,
      "3",
    );
    await click(container.querySelector("[data-testid='mock-modal-panel'] button[aria-label='Close']"));

    const ruleButtonsAfter = container.querySelectorAll(".monitoring-rules-rule-button");
    expect(ruleButtonsAfter[0]?.textContent ?? "").toContain("3");
    expect(ruleButtonsAfter[1]?.textContent ?? "").toContain("2");

    cleanup();
  });

  it("keeps per-rule previews unchanged when global live-preview raw value changes", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Regel hinzufuegen",
      ) ?? null,
    );
    await click(container.querySelector("[data-testid='mock-modal-panel'] button[aria-label='Close']"));

    const before = Array.from(
      container.querySelectorAll(".monitoring-rules-rule-button"),
      (button) => button.textContent ?? "",
    );

    await changeInput(
      container.querySelector<HTMLInputElement>(".monitoring-rules-preview-inputs .text-input"),
      "99",
    );

    const after = Array.from(
      container.querySelectorAll(".monitoring-rules-rule-button"),
      (button) => button.textContent ?? "",
    );
    expect(after).toEqual(before);

    cleanup();
  });

  it("positions the formula view switch above the Attribute Rules heading", async () => {
    const { container, cleanup } = renderPage();
    await flush();

    const switchElement = container.querySelector(".monitoring-rules-view-switch");
    const heading = container.querySelector("h2");
    expect(switchElement).toBeTruthy();
    expect(heading).toBeTruthy();
    const switchBeforeHeading = Boolean(
      switchElement &&
      heading &&
      (switchElement.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    expect(switchBeforeHeading).toBe(true);

    cleanup();
  });

  it("shows grouped formulas across files and renders their references", async () => {
    const markdownByPath: Record<string, string> = {
      "/vault/source-a.md": buildFormulaMarkdown({ key: "f-score", operation: "count" }),
      "/vault/source-b.md": buildFormulaMarkdown({ key: "f-score", operation: "count" }),
    };

    mockInvoke.mockImplementation(async (command, payload) => {
      if (command === "read_text_file") {
        const typedPayload = payload as { path?: string };
        return markdownByPath[typedPayload.path ?? ""] ?? "";
      }
      return "";
    });
    mockUseAppState.mockReturnValue({
      settings: {
        monitoringRenderProfiles: [
          {
            id: "monitoring-status",
            name: "Status",
            attributeAliases: ["status"],
            inputFormat: "code",
            previewRawValue: "2",
            scopes: ["monitoring-page", "database", "properties"],
            enabled: true,
            rules: [
              {
                id: "rule-status-map",
                type: "value-map",
                mappings: [{ from: "2", to: "🟢" }],
                displayMode: "append",
                separator: " ",
              },
            ],
          },
        ],
        setMonitoringRenderProfiles: vi.fn(),
        persistSettings: vi.fn(async () => true),
      },
      vault: {
        vaultPath: "/vault",
        files: [
          { path: "/vault/source-a.md", relative_path: "source-a.md" },
          { path: "/vault/source-b.md", relative_path: "source-b.md" },
        ],
      },
    } as unknown as ReturnType<typeof useAppState>);

    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Formelattribute",
      ) ?? null,
    );
    await flush();

    const formulaListItems = container.querySelectorAll(".monitoring-rules-list-item");
    expect(formulaListItems).toHaveLength(1);
    expect(formulaListItems[0]?.textContent ?? "").toContain("f-score");
    expect(formulaListItems[0]?.textContent ?? "").toContain("2 Fundstellen");
    expect(container.textContent).toContain("source-a.md");
    expect(container.textContent).toContain("source-b.md");
    expect(container.textContent).toContain("Formeldefinition");

    cleanup();
  });

  it("creates a new formula from header actions in formula view", async () => {
    const markdownByPath: Record<string, string> = {
      "/vault/source-a.md": "---\nscore: 42\n---\n# Demo",
    };
    const writeCalls: Array<{ path?: string; contents?: string }> = [];

    mockInvoke.mockImplementation(async (command, payload) => {
      if (command === "read_text_file") {
        const typedPayload = payload as { path?: string };
        return markdownByPath[typedPayload.path ?? ""] ?? "";
      }
      if (command === "write_text_file") {
        const typedPayload = payload as { path?: string; contents?: string };
        writeCalls.push(typedPayload);
        if (typedPayload.path && typeof typedPayload.contents === "string") {
          markdownByPath[typedPayload.path] = typedPayload.contents;
        }
        return null;
      }
      return "";
    });
    mockUseAppState.mockReturnValue({
      settings: {
        monitoringRenderProfiles: [
          {
            id: "monitoring-status",
            name: "Status",
            attributeAliases: ["status"],
            inputFormat: "code",
            previewRawValue: "2",
            scopes: ["monitoring-page", "database", "properties"],
            enabled: true,
            rules: [
              {
                id: "rule-status-map",
                type: "value-map",
                mappings: [{ from: "2", to: "🟢" }],
                displayMode: "append",
                separator: " ",
              },
            ],
          },
        ],
        setMonitoringRenderProfiles: vi.fn(),
        persistSettings: vi.fn(async () => true),
      },
      vault: {
        vaultPath: "/vault",
        files: [
          { path: "/vault/source-a.md", relative_path: "source-a.md" },
        ],
      },
    } as unknown as ReturnType<typeof useAppState>);

    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Formelattribute",
      ) ?? null,
    );
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Formel erstellen",
      ) ?? null,
    );
    await flush();

    expect(writeCalls).toHaveLength(1);
    expect(writeCalls[0]?.path).toBe("/vault/source-a.md");
    expect(writeCalls[0]?.contents ?? "").toContain("f-new-formula:");
    expect(container.textContent).toContain("f-new-formula");

    cleanup();
  });

  it("renames and persists grouped formulas across all source files", async () => {
    const markdownByPath: Record<string, string> = {
      "/vault/source-a.md": buildFormulaMarkdown({ key: "f-score", operation: "count" }),
      "/vault/source-b.md": buildFormulaMarkdown({ key: "f-score", operation: "count" }),
    };
    const writeCalls: Array<{ path?: string; contents?: string }> = [];

    mockInvoke.mockImplementation(async (command, payload) => {
      if (command === "read_text_file") {
        const typedPayload = payload as { path?: string };
        return markdownByPath[typedPayload.path ?? ""] ?? "";
      }
      if (command === "write_text_file") {
        const typedPayload = payload as { path?: string; contents?: string };
        writeCalls.push(typedPayload);
        if (typedPayload.path && typeof typedPayload.contents === "string") {
          markdownByPath[typedPayload.path] = typedPayload.contents;
        }
        return null;
      }
      return "";
    });
    mockUseAppState.mockReturnValue({
      settings: {
        monitoringRenderProfiles: [
          {
            id: "monitoring-status",
            name: "Status",
            attributeAliases: ["status"],
            inputFormat: "code",
            previewRawValue: "2",
            scopes: ["monitoring-page", "database", "properties"],
            enabled: true,
            rules: [
              {
                id: "rule-status-map",
                type: "value-map",
                mappings: [{ from: "2", to: "🟢" }],
                displayMode: "append",
                separator: " ",
              },
            ],
          },
        ],
        setMonitoringRenderProfiles: vi.fn(),
        persistSettings: vi.fn(async () => true),
      },
      vault: {
        vaultPath: "/vault",
        files: [
          { path: "/vault/source-a.md", relative_path: "source-a.md" },
          { path: "/vault/source-b.md", relative_path: "source-b.md" },
        ],
      },
    } as unknown as ReturnType<typeof useAppState>);

    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Formelattribute",
      ) ?? null,
    );
    await flush();

    await changeInput(
      Array.from(container.querySelectorAll<HTMLInputElement>(".monitoring-rules-formula-meta-grid .text-input"))[0] ?? null,
      "f-score-renamed",
    );
    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Formel speichern",
      ) ?? null,
    );
    await flush();

    expect(writeCalls).toHaveLength(2);
    const writePaths = writeCalls.map((entry) => entry.path).sort();
    expect(writePaths).toEqual(["/vault/source-a.md", "/vault/source-b.md"]);
    writeCalls.forEach((entry) => {
      expect(entry.contents ?? "").toContain("f-score-renamed:");
      expect(entry.contents ?? "").not.toContain("f-score:");
    });

    cleanup();
  });

  it("shows conflicts and saves by globally overwriting all grouped occurrences", async () => {
    const markdownByPath: Record<string, string> = {
      "/vault/source-a.md": buildFormulaMarkdown({ key: "f-score", operation: "count" }),
      "/vault/source-b.md": buildFormulaMarkdown({ key: "f-score", operation: "sum" }),
    };
    const writeCalls: Array<{ path?: string; contents?: string }> = [];

    mockInvoke.mockImplementation(async (command, payload) => {
      if (command === "read_text_file") {
        const typedPayload = payload as { path?: string };
        return markdownByPath[typedPayload.path ?? ""] ?? "";
      }
      if (command === "write_text_file") {
        const typedPayload = payload as { path?: string; contents?: string };
        writeCalls.push(typedPayload);
        if (typedPayload.path && typeof typedPayload.contents === "string") {
          markdownByPath[typedPayload.path] = typedPayload.contents;
        }
        return null;
      }
      return "";
    });
    mockUseAppState.mockReturnValue({
      settings: {
        monitoringRenderProfiles: [
          {
            id: "monitoring-status",
            name: "Status",
            attributeAliases: ["status"],
            inputFormat: "code",
            previewRawValue: "2",
            scopes: ["monitoring-page", "database", "properties"],
            enabled: true,
            rules: [
              {
                id: "rule-status-map",
                type: "value-map",
                mappings: [{ from: "2", to: "🟢" }],
                displayMode: "append",
                separator: " ",
              },
            ],
          },
        ],
        setMonitoringRenderProfiles: vi.fn(),
        persistSettings: vi.fn(async () => true),
      },
      vault: {
        vaultPath: "/vault",
        files: [
          { path: "/vault/source-a.md", relative_path: "source-a.md" },
          { path: "/vault/source-b.md", relative_path: "source-b.md" },
        ],
      },
    } as unknown as ReturnType<typeof useAppState>);

    const { container, cleanup } = renderPage();
    await flush();

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Formelattribute",
      ) ?? null,
    );
    await flush();

    expect(container.textContent).toContain("Abweichende Definitionen gefunden");

    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Formel speichern",
      ) ?? null,
    );
    await flush();

    expect(writeCalls).toHaveLength(2);
    writeCalls.forEach((entry) => {
      expect(entry.contents ?? "").toContain("operation: count");
    });

    cleanup();
  });
});
