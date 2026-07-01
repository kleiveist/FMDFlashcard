// @vitest-environment jsdom
import { act, createElement, type ReactElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CanvasPanel } from "./CanvasPanel";
import {
  serializeCanvasDocument,
  type CanvasDocument,
} from "../features/canvas/document";
import { type VaultFile } from "../lib/tree";

const testEnv = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
testEnv.IS_REACT_ACT_ENVIRONMENT = true;

const selectedFile: VaultFile = {
  path: "/vault/canvas.canvas",
  relative_path: "canvas.canvas",
};

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

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const clickButton = async (button: HTMLButtonElement | undefined | null) => {
  expect(button).toBeDefined();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
};

const buttonWithText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === text,
  );

const buttonWithLabel = (container: HTMLElement, label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

const CanvasPanelHarness = ({
  document,
  onPersistSource,
}: {
  document: CanvasDocument;
  onPersistSource: (nextSource: string) => Promise<{ ok: boolean; error?: string }>;
}) => {
  const [source, setSource] = useState(() => serializeCanvasDocument(document));
  return createElement(CanvasPanel, {
    selectedFile,
    preview: source,
    previewState: "idle",
    previewError: "",
    onPersistSource: async (nextSource) => {
      const result = await onPersistSource(nextSource);
      if (result.ok) {
        setSource(nextSource);
      }
      return result;
    },
  });
};

const renderCanvasPanel = (
  document: CanvasDocument,
  onPersistSource = vi.fn().mockResolvedValue({ ok: true }),
) =>
  render(
    createElement(CanvasPanelHarness, {
      document,
      onPersistSource,
    }),
  );

describe("CanvasPanel", () => {
  it("renders the required business canvas surface with the default viewport transform", async () => {
    const { container, cleanup } = renderCanvasPanel({ nodes: [], edges: [] });
    await flush();

    expect(container.querySelector(".business-canvas-editor")).not.toBeNull();
    expect(container.querySelector(".business-canvas-workbench")).not.toBeNull();
    expect(container.querySelector(".business-canvas-viewport")).not.toBeNull();
    expect(container.querySelector(".business-canvas-content")).not.toBeNull();
    expect(container.querySelector(".business-canvas-toolbar-layer")).not.toBeNull();
    expect(container.querySelector(".business-canvas-edges")).not.toBeNull();
    expect(buttonWithLabel(container, "Canvas view mode")).toBeDefined();
    expect(buttonWithLabel(container, "Canvas edit mode")).toBeDefined();
    expect(buttonWithLabel(container, "Canvas JSON mode")).toBeDefined();
    expect(buttonWithText(container, "View")).toBeUndefined();
    expect(buttonWithText(container, "Edit")).toBeUndefined();
    expect(buttonWithText(container, "Code")).toBeUndefined();
    expect(
      container.querySelector<HTMLElement>(".business-canvas-content")?.style.transform,
    ).toBe("translate(-900px, -1020px) scale(1)");

    cleanup();
  });

  it("creates a visible text card at the visible top-left and persists viewport/grid metadata", async () => {
    const onPersistSource = vi.fn().mockResolvedValue({ ok: true });
    const { container, cleanup } = renderCanvasPanel({ nodes: [], edges: [] }, onPersistSource);
    await flush();

    await clickButton(buttonWithLabel(container, "Canvas edit mode"));
    await flush();
    const addCardButton = buttonWithLabel(container, "Add card");
    expect(addCardButton?.disabled).toBe(false);
    await clickButton(addCardButton);
    await flush();

    expect(container.querySelector(".business-canvas-card-node.is-selected")).not.toBeNull();
    expect(onPersistSource).toHaveBeenCalled();

    const lastPersistCall = onPersistSource.mock.calls[onPersistSource.mock.calls.length - 1];
    const savedSource = lastPersistCall?.[0] as string;
    const savedDocument = JSON.parse(savedSource) as CanvasDocument;
    expect(savedDocument.nodes).toHaveLength(1);
    expect(savedDocument.nodes[0]).toMatchObject({
      type: "text",
      text: "Neue Karte",
      width: 240,
      height: 110,
      color: "1",
      shape: "rounded-rectangle",
    });
    expect(savedDocument.nodes[0]?.x).toBe(-280);
    expect(savedDocument.nodes[0]?.y).toBe(-160);
    expect(savedDocument.viewport).toEqual({ x: -900, y: -1020, zoom: 1 });
    expect(savedDocument.grid).toEqual({ size: 20, snap: true });

    cleanup();
  });

  it("renders imported file and link nodes as regular canvas cards", async () => {
    const { container, cleanup } = renderCanvasPanel({
      nodes: [
        {
          id: "file-node",
          type: "file",
          file: "docs/spec.md",
          x: 0,
          y: 0,
          width: 180,
          height: 90,
        },
        {
          id: "link-node",
          type: "link",
          url: "https://example.test",
          x: 220,
          y: 0,
          width: 180,
          height: 90,
        },
      ],
      edges: [],
    });
    await flush();

    const cards = container.querySelectorAll(".business-canvas-card-node");
    expect(cards).toHaveLength(2);
    expect(container.textContent).toContain("docs/spec.md");
    expect(container.textContent).toContain("https://example.test");

    cleanup();
  });
});
