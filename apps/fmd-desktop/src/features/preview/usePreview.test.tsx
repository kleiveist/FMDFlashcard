// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { usePreview } from "./usePreview";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

type PreviewHookValue = {
  preview: string;
  previewError: string;
  previewState: string;
  selectedFile: { path: string; relative_path: string } | null;
  selectFile: (
    file: { path: string; relative_path: string },
    options?: { openInNewTab?: boolean },
  ) => Promise<void>;
  resetPreview: () => void;
};

const renderHook = (
  onValue: (value: PreviewHookValue) => void,
) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const Harness = () => {
    const value = usePreview() as PreviewHookValue;
    onValue(value);
    return null;
  };

  act(() => {
    root.render(createElement(Harness));
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

describe("usePreview", () => {
  it("ignores stale read_text_file responses from older selections", async () => {
    vi.clearAllMocks();
    const firstLoad = createDeferred<string>();
    const secondLoad = createDeferred<string>();
    invokeMock.mockImplementation((command: string, payload: { path: string }) => {
      if (command !== "read_text_file") {
        throw new Error(`Unexpected command: ${command}`);
      }
      if (payload.path.endsWith("/first.md")) {
        return firstLoad.promise;
      }
      if (payload.path.endsWith("/second.md")) {
        return secondLoad.promise;
      }
      return Promise.resolve("");
    });

    let latestValue: PreviewHookValue | null = null;
    const { cleanup } = renderHook((value) => {
      latestValue = value;
    });
    const getLatestValue = () => {
      expect(latestValue).toBeTruthy();
      return latestValue as PreviewHookValue;
    };

    const firstFile = {
      path: "/vault/first.md",
      relative_path: "first.md",
    };
    const secondFile = {
      path: "/vault/second.md",
      relative_path: "second.md",
    };

    await act(async () => {
      void getLatestValue().selectFile(firstFile);
      void getLatestValue().selectFile(secondFile);
    });
    expect(getLatestValue().selectedFile?.path).toBe("/vault/second.md");
    expect(getLatestValue().previewState).toBe("loading");

    await act(async () => {
      secondLoad.resolve("Second file content");
      await Promise.resolve();
    });
    expect(getLatestValue().preview).toBe("Second file content");
    expect(getLatestValue().previewState).toBe("idle");
    expect(getLatestValue().selectedFile?.path).toBe("/vault/second.md");

    await act(async () => {
      firstLoad.resolve("First file stale content");
      await Promise.resolve();
    });
    expect(getLatestValue().preview).toBe("Second file content");
    expect(getLatestValue().previewState).toBe("idle");
    expect(getLatestValue().selectedFile?.path).toBe("/vault/second.md");

    cleanup();
  });

  it("invalidates pending loads when resetPreview is called", async () => {
    vi.clearAllMocks();
    const pendingLoad = createDeferred<string>();
    invokeMock.mockImplementation((command: string) => {
      if (command !== "read_text_file") {
        throw new Error(`Unexpected command: ${command}`);
      }
      return pendingLoad.promise;
    });

    let latestValue: PreviewHookValue | null = null;
    const { cleanup } = renderHook((value) => {
      latestValue = value;
    });
    const getLatestValue = () => {
      expect(latestValue).toBeTruthy();
      return latestValue as PreviewHookValue;
    };

    await act(async () => {
      void getLatestValue().selectFile({
        path: "/vault/first.md",
        relative_path: "first.md",
      });
    });
    expect(getLatestValue().previewState).toBe("loading");

    act(() => {
      getLatestValue().resetPreview();
    });
    expect(getLatestValue().selectedFile).toBeNull();
    expect(getLatestValue().preview).toBe("");
    expect(getLatestValue().previewState).toBe("idle");

    await act(async () => {
      pendingLoad.resolve("late content");
      await Promise.resolve();
    });

    expect(getLatestValue().selectedFile).toBeNull();
    expect(getLatestValue().preview).toBe("");
    expect(getLatestValue().previewState).toBe("idle");
    expect(getLatestValue().previewError).toBe("");

    cleanup();
  });
});
