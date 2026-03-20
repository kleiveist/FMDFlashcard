// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const dashboardGuard = vi.hoisted(() => ({
  canLeave: true,
  requests: 0,
}));

const appStateHolder = vi.hoisted(() => ({
  value: null as unknown,
}));

vi.mock("./components/AppStateProvider", async () => {
  const ReactModule = await import("react");
  return {
    AppStateProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useAppState: () => appStateHolder.value,
  };
});

vi.mock("./components/AppErrorBoundary", async () => {
  const ReactModule = await import("react");
  return {
    AppErrorBoundary: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock("./lib/layoutMode", async () => {
  const ReactModule = await import("react");
  return {
    LayoutModeProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useLayoutMode: () => "table",
  };
});

vi.mock("./lib/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => false),
}));

vi.mock("./components/SidebarNav", () => ({
  SidebarNav: ({
    onTabChange,
    onSelectVaultFile,
  }: {
    onTabChange: (tab: string) => void;
    onSelectVaultFile?: (file: { path: string; relative_path: string }) => void;
  }) =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "sidebar-switch-exam",
          onClick: () => onTabChange("exam"),
        },
        "Sidebar: exam",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "sidebar-select-file",
          onClick: () =>
            onSelectVaultFile?.({
              path: "/vault/from-sidebar.md",
              relative_path: "from-sidebar.md",
            }),
        },
        "Sidebar: select file",
      ),
    ),
}));

vi.mock("./components/StudySectionNav", () => ({
  StudySectionNav: ({
    onSectionSelect,
  }: {
    onSectionSelect: (tab: string) => void;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": "study-nav-switch-exam",
        onClick: () => onSectionSelect("exam"),
      },
      "StudyNav: exam",
    ),
}));

vi.mock("./pages/DashboardPage", async () => {
  const ReactModule = await import("react");
  const DashboardPage = ReactModule.forwardRef((_props, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({
      requestVaultViewChange: () => {},
      requestLeaveDashboard: async () => {
        dashboardGuard.requests += 1;
        return dashboardGuard.canLeave;
      },
    }));
    return ReactModule.createElement(
      "div",
      { "data-testid": "mock-dashboard-page" },
      "Dashboard",
    );
  });
  DashboardPage.displayName = "MockDashboardPage";
  return { DashboardPage };
});

vi.mock("./pages/ExamSimulationPage", () => ({
  ExamSimulationPage: ({
    onOpenExamFileInMarkdownEditor,
  }: {
    onOpenExamFileInMarkdownEditor?: (
      file: { path: string; relative_path: string },
      options?: { openInNewTab?: boolean },
    ) => void;
  }) =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "div",
        { "data-testid": "mock-exam-simulation-page" },
        "Exam",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "mock-exam-open-markdown-file",
          onClick: () =>
            onOpenExamFileInMarkdownEditor?.({
              path: "/vault/from-exam-open.md",
              relative_path: "from-exam-open.md",
            }),
        },
        "Exam: open markdown file",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "mock-exam-open-markdown-file-new-tab",
          onClick: () =>
            onOpenExamFileInMarkdownEditor?.(
              {
                path: "/vault/from-exam-open-new-tab.md",
                relative_path: "from-exam-open-new-tab.md",
              },
              { openInNewTab: true },
            ),
        },
        "Exam: open markdown file in new tab",
      ),
    ),
}));

vi.mock("./pages/FlashcardPage", () => ({
  FlashcardPage: () => React.createElement("div", null, "Flashcard"),
}));

vi.mock("./pages/FastFlashcardPage", () => ({
  FastFlashcardPage: () => React.createElement("div", null, "Fast"),
}));

vi.mock("./pages/SpacedRepetitionPage", () => ({
  SpacedRepetitionPage: () => React.createElement("div", null, "SR"),
}));

vi.mock("./pages/HelpPage", () => ({
  HelpPage: () => React.createElement("div", null, "Help"),
}));

vi.mock("./pages/SettingsPage", () => ({
  SettingsPage: () => React.createElement("div", null, "Settings"),
}));

vi.mock("./components/ModalShell", () => ({
  ModalShell: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? React.createElement("div", null, children) : null),
}));

vi.mock("./components/NoteModal", () => ({
  NoteModal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? React.createElement("div", null, children) : null),
}));

vi.mock("./components/NoteFilesPanel", () => ({
  NoteFilesPanel: () => React.createElement("div", null, "NoteFiles"),
}));

vi.mock("./components/CursorAccessoryOverlay", () => ({
  CursorAccessoryOverlay: () => null,
}));

vi.mock("./components/UserVaultGateModals", () => ({
  UserVaultCustomPathModal: () => null,
  UserVaultProfileModal: () => null,
  UserVaultSyncProviderModal: () => null,
}));

vi.mock("./components/settings/ProfileSetupSections", () => ({
  UserListSection: () => React.createElement("div", null, "UserList"),
}));

vi.mock("./keybindings/registerGlobalShortcuts", () => ({
  registerGlobalShortcuts: () => () => {},
}));

vi.mock("./features/settings/settingsDeepLink", () => ({
  subscribeSettingsFocus: () => () => {},
}));

vi.mock("./features/input-debug/useInputDebug", () => ({
  useInputDebugInstrumentation: () => {},
}));

vi.mock("./lib/shortcuts/registry", () => ({
  getShortcutById: () => null,
}));

vi.mock("./lib/shortcuts/bindings", () => ({
  getEffectiveBinding: () => null,
  getShortcutPlatform: () => "linux",
  isEditableTarget: () => false,
  matchesBinding: () => false,
}));

vi.mock("./lib/shortcuts/closeOrBack", () => ({
  getActiveCloseLayer: () => null,
}));

vi.mock("./lib/featureFlags", () => ({
  isSyncProviderEnabled: () => false,
  logWordPressFeatureStatus: () => {},
}));

const createMockAppState = () => ({
  actions: {
    handlePickVault: vi.fn(async () => false),
    handleSwitchVault: vi.fn(async () => false),
    handleRescanVault: vi.fn(async () => false),
    handleSelectFile: vi.fn(),
  },
  flashcardNoteFiles: [],
  flashcardNoteFilesError: "",
  flashcardNoteFilesState: "idle",
  flashcards: {
    isFlashcardScanning: false,
    handleFlashcardScan: vi.fn(async () => {}),
  },
  fastFlashcards: {
    isFlashcardScanning: false,
    handleFlashcardScan: vi.fn(async () => {}),
  },
  help: {
    setActiveTopicId: vi.fn(),
  },
  preview: {
    selectedFile: null,
  },
  settings: {
    inputDebugEnabled: false,
    inputDebugRedactContent: true,
    keyboardShortcuts: { bindings: {} },
    cursorAccessoryEnabled: false,
    recentVaults: [],
  },
  settingsNav: {
    setActiveSettingsPage: vi.fn(),
  },
  spacedRepetition: {
    spacedRepetitionActiveUser: null,
    spacedRepetitionActiveUserId: null,
    handleSpacedRepetitionActiveUserLoadCards: vi.fn(async () => {}),
  },
  userVault: {
    mode: "auto",
    resolvedPath: "/user-vault",
    status: "ready",
  },
  vault: {
    vaultPath: "/vault",
    listState: "idle",
  },
});

const getSelectFileSpy = () =>
  (appStateHolder.value as { actions: { handleSelectFile: ReturnType<typeof vi.fn> } })
    .actions.handleSelectFile;

const renderApp = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(App));
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

const clickTestId = async (container: HTMLElement, testId: string) => {
  const target = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  expect(target).toBeTruthy();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

describe("App dashboard leave guard integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardGuard.canLeave = true;
    dashboardGuard.requests = 0;
    appStateHolder.value = createMockAppState();
  });

  it("blocks tab switches when Dashboard denies leave for sidebar and study nav", async () => {
    dashboardGuard.canLeave = false;
    const { container, cleanup } = renderApp();

    expect(container.querySelector('[data-testid="mock-dashboard-page"]')).toBeTruthy();

    await clickTestId(container, "sidebar-switch-exam");
    await clickTestId(container, "study-nav-switch-exam");

    expect(dashboardGuard.requests).toBe(2);
    expect(container.querySelector('[data-testid="mock-dashboard-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeNull();

    cleanup();
  });

  it("allows tab switch when Dashboard confirms leave", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "study-nav-switch-exam");

    expect(dashboardGuard.requests).toBe(1);
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeTruthy();

    cleanup();
  });

  it("guards sidebar vault-file selection and keeps file when leave is denied", async () => {
    dashboardGuard.canLeave = false;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "sidebar-select-file");

    expect(dashboardGuard.requests).toBe(1);
    expect(getSelectFileSpy()).not.toHaveBeenCalled();

    cleanup();
  });

  it("allows sidebar vault-file selection when leave is confirmed", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "sidebar-select-file");

    expect(dashboardGuard.requests).toBe(1);
    expect(getSelectFileSpy()).toHaveBeenCalledWith({
      path: "/vault/from-sidebar.md",
      relative_path: "from-sidebar.md",
    });

    cleanup();
  });

  it("opens exam file in dashboard markdown editor and selects file", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "study-nav-switch-exam");
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeTruthy();

    await clickTestId(container, "mock-exam-open-markdown-file");

    expect(getSelectFileSpy()).toHaveBeenCalledWith({
      path: "/vault/from-exam-open.md",
      relative_path: "from-exam-open.md",
    }, undefined);
    expect(container.querySelector('[data-testid="mock-dashboard-page"]')).toBeTruthy();

    cleanup();
  });

  it("passes new-tab open options when exam opens markdown file with ctrl intent", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "study-nav-switch-exam");
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeTruthy();

    await clickTestId(container, "mock-exam-open-markdown-file-new-tab");

    expect(getSelectFileSpy()).toHaveBeenCalledWith(
      {
        path: "/vault/from-exam-open-new-tab.md",
        relative_path: "from-exam-open-new-tab.md",
      },
      { openInNewTab: true },
    );
    expect(container.querySelector('[data-testid="mock-dashboard-page"]')).toBeTruthy();

    cleanup();
  });
});
