// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useFlashcardAreaToggle } from "./useFlashcardAreaToggle";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

const invokeMock = vi.mocked(invoke);

type HookOptions = Parameters<typeof useFlashcardAreaToggle>[0];
type HookState = ReturnType<typeof useFlashcardAreaToggle> | null;

const Probe = ({
  options,
  onValue,
}: {
  options: HookOptions;
  onValue: (value: ReturnType<typeof useFlashcardAreaToggle>) => void;
}) => {
  onValue(useFlashcardAreaToggle(options));
  return null;
};

const renderHook = (
  options: HookOptions,
  onValue: (value: ReturnType<typeof useFlashcardAreaToggle>) => void,
) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(Probe, { options, onValue }));
  });

  return {
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const flush = async (times = 1) => {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe("useFlashcardAreaToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists full task-scope wrapper toggle and refreshes preview/rescan", async () => {
    const sourceContent = [
      "Intro",
      "1) First question?",
      "Answer: One",
      "",
      "2) Second question?",
      "Answer: Two",
    ].join("\n");
    let writtenContents = "";

    invokeMock.mockImplementation((command, args) => {
      if (command === "read_text_file") {
        expect(args).toEqual({ path: "/vault/note.md" });
        return Promise.resolve(sourceContent);
      }
      if (command === "write_text_file_atomic") {
        const payload = args as { path: string; contents: string };
        writtenContents = payload.contents;
        expect(payload.path).toBe("/vault/note.md");
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    const setPreview = vi.fn();
    const onRescanVault = vi.fn().mockResolvedValue(true);
    const options: HookOptions = {
      sourceByIndex: {
        0: {
          sourcePath: "/vault/note.md",
          sourceRange: {
            startLine: 1,
            endLine: 3,
          },
          cardWrapper: false,
        },
      },
      previewPath: "/vault/note.md",
      setPreview,
      onRescanVault,
      rescanSource: "flashcard-area-toggle-test",
    };

    let latest: HookState = null;
    const { cleanup } = renderHook(options, (value) => {
      latest = value;
    });

    act(() => {
      latest?.toggleCardArea(0, true);
    });
    await flush(4);

    expect(invokeMock).toHaveBeenCalledWith("read_text_file", { path: "/vault/note.md" });
    expect(invokeMock).toHaveBeenCalledWith(
      "write_text_file_atomic",
      expect.objectContaining({ path: "/vault/note.md" }),
    );
    expect(writtenContents).toContain("#card\n1) First question?\nAnswer: One\n#endcard");
    expect(writtenContents).toContain("2) Second question?\nAnswer: Two");
    expect(setPreview).toHaveBeenCalledWith(writtenContents);
    expect(onRescanVault).toHaveBeenCalledWith("flashcard-area-toggle-test");

    const toggleState = latest?.getToggleState(0);
    expect(toggleState?.enabled).toBe(true);
    expect(toggleState?.pending).toBe(false);
    expect(toggleState?.error).toBe("");
    cleanup();
  });

  it("rolls back optimistic state and keeps menu-usable error state on write failure", async () => {
    const sourceContent = [
      "Intro",
      "#card",
      "1) First question?",
      "Answer: One",
      "#endcard",
      "Outro",
    ].join("\n");

    invokeMock.mockImplementation((command, args) => {
      if (command === "read_text_file") {
        expect(args).toEqual({ path: "/vault/note.md" });
        return Promise.resolve(sourceContent);
      }
      if (command === "write_text_file_atomic") {
        return Promise.reject(new Error("Disk full"));
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    const setPreview = vi.fn();
    const onRescanVault = vi.fn().mockResolvedValue(true);
    const options: HookOptions = {
      sourceByIndex: {
        0: {
          sourcePath: "/vault/note.md",
          sourceRange: {
            startLine: 1,
            endLine: 4,
          },
          cardWrapper: true,
        },
      },
      previewPath: "/vault/note.md",
      setPreview,
      onRescanVault,
      rescanSource: "flashcard-area-toggle-test",
    };

    let latest: HookState = null;
    const { cleanup } = renderHook(options, (value) => {
      latest = value;
    });

    act(() => {
      latest?.toggleCardArea(0, false);
    });

    const optimisticState = latest?.getToggleState(0);
    expect(optimisticState?.enabled).toBe(false);
    expect(optimisticState?.pending).toBe(true);

    await flush(4);

    const settledState = latest?.getToggleState(0);
    expect(settledState?.enabled).toBe(true);
    expect(settledState?.pending).toBe(false);
    expect(settledState?.error.toLowerCase()).toContain("disk full");
    expect(onRescanVault).not.toHaveBeenCalled();
    expect(setPreview).not.toHaveBeenCalled();
    cleanup();
  });
});
