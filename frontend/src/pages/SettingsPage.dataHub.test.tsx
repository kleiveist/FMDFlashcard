/**
 * @file apps/fmd-desktop/src/pages/SettingsPage.dataHub.test.tsx
 *
 * Zweck:
 * - Regressionstest fuer den kompakten Data-Hub-Tabbereich in Settings.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

const { mockUseAppState } = vi.hoisted(() => ({
  mockUseAppState: vi.fn(),
}));

vi.mock("../components/AppStateProvider", () => ({
  useAppState: () => mockUseAppState(),
}));

vi.mock("../lib/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("../features/settings/settingsDeepLink", () => ({
  subscribeSettingsFocus: () => () => {},
  consumeSettingsFocusRequest: () => null,
}));

const noop = vi.fn();
const asyncNoop = vi.fn(async () => false);

const createMockState = () => {
  const settings = new Proxy(
    {
      language: "en",
      setLanguage: noop,
      recentVaults: [] as Array<{ path: string }>,
      showHiddenFolders: false,
      showEmptyFolders: true,
      setShowHiddenFolders: noop,
      setShowEmptyFolders: noop,
    },
    {
      get(target, property) {
        if (property in target) {
          return target[property as keyof typeof target];
        }
        return noop;
      },
    },
  );

  const actions = new Proxy(
    {
      handleOpenVaultManager: noop,
      handleSwitchVault: asyncNoop,
      handlePickVault: asyncNoop,
      handleCopyVaultPath: asyncNoop,
      handleRescanVault: asyncNoop,
      handleResetIndex: noop,
      handleMaxFilesPerScanChange: noop,
    },
    {
      get(target, property) {
        if (property in target) {
          return target[property as keyof typeof target];
        }
        return noop;
      },
    },
  );

  return {
    actions,
    flashcards: {},
    preview: { selectedFile: null },
    settings,
    settingsNav: {
      activeSettingsPage: "vault-index",
      setActiveSettingsPage: noop,
    },
    spacedRepetition: {},
    userVault: { activeProfilePath: null, profileRootPath: null },
    vault: {
      vaultPath: "/vault",
      listState: "idle",
      listError: "",
      lastRefreshAt: "2026-04-03T22:24:11.000Z",
    },
  } as any;
};

describe("SettingsPage Data Hub", () => {
  beforeEach(() => {
    mockUseAppState.mockReset();
    mockUseAppState.mockReturnValue(createMockState());
  });

  it("renders Data & Index tablist with all three hub tabs and default Data & Index content", () => {
    const markup = renderToStaticMarkup(createElement(SettingsPage));

    expect(markup).toContain('aria-label="Data &amp; Index pages"');
    expect(markup).toContain(">Data &amp; Index<");
    expect(markup).toContain(">Profile Source<");
    expect(markup).toContain(">Ex- Import<");
    expect(markup).toContain("vault-index-panel");
    expect(markup).toContain(">Actions<");
  });
});
