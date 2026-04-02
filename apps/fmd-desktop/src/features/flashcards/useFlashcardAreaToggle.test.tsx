// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskMutationScope } from "../../lib/taskAreaToggle";
import { useFlashcardAreaToggle } from "./useFlashcardAreaToggle";

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

type HookOptions = Parameters<typeof useFlashcardAreaToggle>[0];
type HookValue = ReturnType<typeof useFlashcardAreaToggle> | null;

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
  initialOptions: HookOptions,
  onValue: (value: ReturnType<typeof useFlashcardAreaToggle>) => void,
) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let options = initialOptions;

  const render = () => {
    act(() => {
      root.render(createElement(Probe, { options, onValue }));
    });
  };

  render();

  return {
    rerender: (nextOptions: HookOptions) => {
      options = nextOptions;
      render();
    },
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

describe("useFlashcardAreaToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stages toggle intent and keeps staged state across rerender", () => {
    const stagedByKey = new Map<string, boolean>();
    const noticeByKey = new Map<string, string>();
    const stageTaskAreaToggle = vi.fn((scope: TaskMutationScope, nextEnabled: boolean) => {
      stagedByKey.set(
        `${scope.sourcePath}:${scope.sourceRange.startLine}-${scope.sourceRange.endLine}`,
        nextEnabled,
      );
    });
    const getStagedTaskAreaToggle = vi.fn((scope: TaskMutationScope) =>
      stagedByKey.get(
        `${scope.sourcePath}:${scope.sourceRange.startLine}-${scope.sourceRange.endLine}`,
      ) ?? null,
    );
    const getTaskAreaToggleNotice = vi.fn((scope: TaskMutationScope) =>
      noticeByKey.get(
        `${scope.sourcePath}:${scope.sourceRange.startLine}-${scope.sourceRange.endLine}`,
      ) ?? "",
    );

    const sourceMeta = {
      sourcePath: "/vault/note.md",
      sourceRange: {
        startLine: 10,
        endLine: 14,
      },
      cardWrapper: false,
    };
    const options: HookOptions = {
      sourceByIndex: {
        0: sourceMeta,
      },
      stageTaskAreaToggle,
      getStagedTaskAreaToggle,
      getTaskAreaToggleNotice,
    };

    let latest: HookValue = null;
    const { rerender, cleanup } = renderHook(options, (value) => {
      latest = value;
    });

    expect(latest?.getToggleState(0).enabled).toBe(false);
    expect(latest?.getToggleState(0).pending).toBe(false);

    act(() => {
      latest?.toggleCardArea(0, true);
    });

    expect(stageTaskAreaToggle).toHaveBeenCalledWith(
      {
        sourcePath: "/vault/note.md",
        sourceRange: { startLine: 10, endLine: 14 },
      },
      true,
    );
    expect(latest?.getToggleState(0).enabled).toBe(true);

    rerender({
      ...options,
      sourceByIndex: {
        0: {
          ...sourceMeta,
          cardWrapper: false,
        },
      },
    });
    expect(latest?.getToggleState(0).enabled).toBe(true);
    cleanup();
  });

  it("returns disable reason for invalid source scope and does not stage", () => {
    const stageTaskAreaToggle = vi.fn();
    const options: HookOptions = {
      sourceByIndex: {
        2: {
          sourcePath: "/vault/note.md",
          sourceRange: null,
          cardWrapper: true,
        },
      },
      stageTaskAreaToggle,
      getStagedTaskAreaToggle: () => null,
      getTaskAreaToggleNotice: () => "",
    };

    let latest: HookValue = null;
    const { cleanup } = renderHook(options, (value) => {
      latest = value;
    });

    const state = latest?.getToggleState(2);
    expect(state?.disabledReason).toContain("range");

    act(() => {
      latest?.toggleCardArea(2, false);
    });

    expect(stageTaskAreaToggle).not.toHaveBeenCalled();
    cleanup();
  });

  it("shows notice from central pending-store", () => {
    const options: HookOptions = {
      sourceByIndex: {
        4: {
          sourcePath: "/vault/lesson.md",
          sourceRange: {
            startLine: 1,
            endLine: 5,
          },
          cardWrapper: true,
        },
      },
      stageTaskAreaToggle: vi.fn(),
      getStagedTaskAreaToggle: () => null,
      getTaskAreaToggleNotice: () => "Saved at tab switch.",
    };

    let latest: HookValue = null;
    const { cleanup } = renderHook(options, (value) => {
      latest = value;
    });

    const state = latest?.getToggleState(4);
    expect(state?.notice).toBe("Saved at tab switch.");
    expect(state?.error).toBe("");
    cleanup();
  });
});
