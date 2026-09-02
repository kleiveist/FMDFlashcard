// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardMonitoringPage } from "./CardMonitoringPage";
import { useAppState } from "../components/AppStateProvider";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../components/AppStateProvider", () => ({
  useAppState: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
}));

vi.mock("../components/ModalShell", () => ({
  ModalShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? React.createElement("div", null, children) : null,
}));

const mockUseAppState = vi.mocked(useAppState);
const mockInvoke = vi.mocked(invoke);

const click = async (element: Element | null) => {
  expect(element).toBeTruthy();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const findButton = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label,
  ) ?? null;

const renderPage = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(CardMonitoringPage));
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

describe("CardMonitoringPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scans markdown files and renders grouped card rows", async () => {
    const handleRescanVault = vi.fn(async () => true);
    const handleSelectFile = vi.fn();

    const files = [
      { path: "/vault/a.md", relative_path: "folder/a.md" },
      { path: "/vault/b.md", relative_path: "b.md" },
    ];

    const contentsByPath: Record<string, string> = {
      "/vault/a.md": [
        "#card",
        "Question A",
        "Answer: value",
        "#endcard",
        "",
        "#card",
        "Question A2",
        "Answer: value",
        "#endcard",
      ].join("\n"),
      "/vault/b.md": ["#card", "Question B", "Answer: value", "#endcard"].join("\n"),
    };

    mockUseAppState.mockReturnValue({
      actions: {
        handleRescanVault,
        handleSelectFile,
      },
      preview: {
        selectedFile: null,
        setPreview: vi.fn(),
      },
      vault: {
        vaultPath: "/vault",
        files,
      },
    } as unknown as ReturnType<typeof useAppState>);

    mockInvoke.mockImplementation(async (command, args) => {
      const payload =
        args && typeof args === "object" && !Array.isArray(args)
          ? (args as Record<string, unknown>)
          : {};
      if (command === "read_text_file") {
        return contentsByPath[String(payload.path ?? "")] ?? "";
      }
      return null;
    });

    const { container, cleanup } = renderPage();
    await flush();

    expect(container.textContent).toContain("Card Monitoring");
    expect(container.textContent).toContain("folder");
    expect(container.textContent).toContain("a.md");
    expect(container.textContent).toContain("Question A");
    expect(container.textContent).toContain("Question B");

    cleanup();
  });

  it("writes changes only after explicit save", async () => {
    const handleRescanVault = vi.fn(async () => true);
    const handleSelectFile = vi.fn();
    const setPreview = vi.fn();

    const files = [{ path: "/vault/a.md", relative_path: "a.md" }];
    const contentsByPath: Record<string, string> = {
      "/vault/a.md": ["#card", "Question A", "Answer: value", "#endcard"].join("\n"),
    };

    mockUseAppState.mockReturnValue({
      actions: {
        handleRescanVault,
        handleSelectFile,
      },
      preview: {
        selectedFile: { path: "/vault/a.md", relative_path: "a.md" },
        setPreview,
      },
      vault: {
        vaultPath: "/vault",
        files,
      },
    } as unknown as ReturnType<typeof useAppState>);

    mockInvoke.mockImplementation(async (command, args) => {
      const payload =
        args && typeof args === "object" && !Array.isArray(args)
          ? (args as Record<string, unknown>)
          : {};
      if (command === "read_text_file") {
        return contentsByPath[String(payload.path ?? "")] ?? "";
      }
      if (command === "write_text_file_atomic") {
        const path = String(payload.path ?? "");
        const contents = String(payload.contents ?? "");
        contentsByPath[path] = contents;
        return null;
      }
      return null;
    });

    const { container, cleanup } = renderPage();
    await flush();

    const cardCheckbox = container.querySelector<HTMLInputElement>(
      ".card-monitoring-row-card input[type='checkbox']",
    );
    await click(cardCheckbox);

    await click(findButton(container, "Stage remove wrapper"));

    const writesBeforeSave = mockInvoke.mock.calls.filter(
      (call) => call[0] === "write_text_file_atomic",
    );
    expect(writesBeforeSave).toHaveLength(0);

    await click(findButton(container, "Save"));
    await flush();

    const writesAfterSave = mockInvoke.mock.calls.filter(
      (call) => call[0] === "write_text_file_atomic",
    );
    expect(writesAfterSave).toHaveLength(1);
    expect(contentsByPath["/vault/a.md"]).toBe(["Question A", "Answer: value"].join("\n"));
    expect(handleRescanVault).toHaveBeenCalledWith("card-monitoring-save");
    expect(setPreview).toHaveBeenCalledWith(["Question A", "Answer: value"].join("\n"));

    cleanup();
  });
});
