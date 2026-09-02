import { vi } from "vitest";

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
  process?: { versions: { node: string } };
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

const nodeMajor = Number.parseInt(testEnv.process?.versions.node.split(".")[0] ?? "0", 10);
if (typeof window !== "undefined" && nodeMajor >= 25) {
  // Node 25+ exposes an undefined localStorage getter unless --localstorage-file is set.
  // That getter shadows jsdom's Storage implementation in Vitest, so provide an isolated
  // in-memory implementation for browser-oriented tests.
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(String(key)) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(String(key)),
    setItem: (key, value) => values.set(String(key), String(value)),
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorage,
  });
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue(undefined),
  revealItemInDir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}));

if (typeof Element !== "undefined" && !("scrollIntoView" in Element.prototype)) {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
}
