// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { VaultTree } from "./VaultTree";
import type { VaultFile } from "../lib/tree";

const clickButton = async (
  element: HTMLElement,
  options?: {
    ctrlKey?: boolean;
    metaKey?: boolean;
  },
) => {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: options?.ctrlKey,
        metaKey: options?.metaKey,
      }),
    );
  });
};

describe("VaultTree interactions", () => {
  it("forwards ctrl/cmd click as open-in-new-tab intent", async () => {
    const file: VaultFile = {
      path: "/vault/toolbar-note.md",
      relative_path: "toolbar-note.md",
    };
    const onSelectFile = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(VaultTree, {
          activeFolderPath: null,
          expandedPaths: new Set<string>(),
          fileCountLabel: "1 Markdown-Datei",
          files: [file],
          folders: [],
          showHiddenFolders: false,
          showEmptyFolders: false,
          listError: "",
          listState: "idle",
          onRescanVault: async () => false,
          onActiveFolderChange: () => undefined,
          onTogglePath: () => undefined,
          onSelectFile,
          selectedFile: null,
          vaultPath: "/vault",
        }),
      );
    });

    const fileButton = container.querySelector<HTMLButtonElement>(
      'button.tree-item.tree-file[title="toolbar-note.md"]',
    );
    expect(fileButton).toBeTruthy();

    if (!fileButton) {
      throw new Error("Expected markdown tree button to be rendered.");
    }

    await clickButton(fileButton);
    await clickButton(fileButton, { ctrlKey: true });
    await clickButton(fileButton, { metaKey: true });

    expect(onSelectFile).toHaveBeenNthCalledWith(1, file, { openInNewTab: false });
    expect(onSelectFile).toHaveBeenNthCalledWith(2, file, { openInNewTab: true });
    expect(onSelectFile).toHaveBeenNthCalledWith(3, file, { openInNewTab: true });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
