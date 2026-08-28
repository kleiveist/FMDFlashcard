/**
 * @file frontend/src/components/settings/VaultIndexSection.test.ts
 *
 * Zweck:
 * - Tests fuer den integrierten Data-&-Index-Panelaufbau.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VaultIndexSection } from "./VaultIndexSection";

describe("VaultIndexSection", () => {
  it("renders actions, refresh status and integrated vault data toggles in one panel", () => {
    const markup = renderToStaticMarkup(
      createElement(VaultIndexSection, {
        language: "en",
        lastOpenedFile: "notes/example.md",
        listState: "idle",
        listError: "",
        lastRefreshAt: "2026-04-03T22:24:11.000Z",
        onCopyVaultPath: vi.fn(async () => {}),
        onShowHiddenFoldersToggle: vi.fn(),
        onShowEmptyFoldersToggle: vi.fn(),
        onRescanVault: vi.fn(async () => true),
        onResetIndex: vi.fn(),
        vaultIndexedComplete: true,
        showHiddenFolders: false,
        showEmptyFolders: true,
        vaultPath: "/vault",
      }),
    );

    expect(markup).toContain("vault-index-panel");
    expect(markup).toContain("Rescan vault");
    expect(markup).toContain("Reset index");
    expect(markup).toContain("Reset index clears the current vault registration.");
    expect(markup).toContain("Last refresh:");
    expect(markup).toContain("Show Hidden Folders");
    expect(markup).toContain("Show Empty Folders");
    expect(markup).toContain("settings-vault-index-show-hidden-folders");
    expect(markup).toContain("settings-vault-index-show-empty-folders");
    expect(markup).not.toContain("vault-data-panel");
    expect(markup).not.toContain("settings-vault-data-show-hidden-folders");
    expect(markup).not.toContain("settings-vault-data-show-empty-folders");
  });
});
