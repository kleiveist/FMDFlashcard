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

const createMockState = (language: "de" | "en") => {
  const settings = new Proxy(
    {
      language,
      setLanguage: noop,
      recentVaults: [] as Array<{ path: string }>,
      currentSystemRecentVaults: [] as Array<{ path: string }>,
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
      activeSettingsPage: "language",
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

describe("SettingsPage language rendering", () => {
  beforeEach(() => {
    mockUseAppState.mockReset();
  });

  it("renders the language panel in english when english is active", () => {
    mockUseAppState.mockReturnValue(createMockState("en"));
    const markup = renderToStaticMarkup(createElement(SettingsPage));

    expect(markup).toContain(">Language Pages<");
    expect(markup).toContain(">Set the app language.<");
    expect(markup).toContain(">German<");
    expect(markup).toContain(">English<");
    expect(markup).toContain(">Manage Vaults<");
  });

  it("renders the language panel in german when german is active", () => {
    mockUseAppState.mockReturnValue(createMockState("de"));
    const markup = renderToStaticMarkup(createElement(SettingsPage));

    expect(markup).toContain(">Sprachseiten<");
    expect(markup).toContain(">App-Sprache festlegen.<");
    expect(markup).toContain(">German<");
    expect(markup).toContain(">English<");
    expect(markup).toContain(">Vaults verwalten<");
    expect(markup).toContain(">Exam Editor<");
  });
});
