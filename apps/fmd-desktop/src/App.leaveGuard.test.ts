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

const cardMonitoringGuard = vi.hoisted(() => ({
  canLeave: true,
  requests: 0,
}));

const dashboardViewRequests = vi.hoisted(() => ({
  values: [] as string[],
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
    onSelectVaultFile?: (
      file: { path: string; relative_path: string },
      options?: { openInNewTab?: boolean },
    ) => void;
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
          "data-testid": "sidebar-switch-card-monitoring",
          onClick: () => onTabChange("card-monitoring"),
        },
        "Sidebar: card monitoring",
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
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "sidebar-select-file-new-tab",
          onClick: () =>
            onSelectVaultFile?.(
              {
                path: "/vault/from-sidebar-new-tab.md",
                relative_path: "from-sidebar-new-tab.md",
              },
              { openInNewTab: true },
            ),
        },
        "Sidebar: select file new tab",
      ),
    ),
}));

vi.mock("./components/StudySectionNav", () => ({
  StudySectionNav: ({
    onSectionSelect,
    onDashboardViewSelect,
  }: {
    onSectionSelect: (tab: string) => void;
    onDashboardViewSelect: (view: "markdown" | "exam") => void;
  }) =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "study-nav-open-editor-markdown",
          onClick: () => onDashboardViewSelect("markdown"),
        },
        "StudyNav: open markdown editor",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "study-nav-open-editor-exam",
          onClick: () => onDashboardViewSelect("exam"),
        },
        "StudyNav: open exam editor",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "study-nav-switch-exam",
          onClick: () => onSectionSelect("exam"),
        },
        "StudyNav: exam",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "study-nav-switch-flashcard",
          onClick: () => onSectionSelect("flashcard"),
        },
        "StudyNav: flashcard",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "study-nav-switch-card-monitoring",
          onClick: () => onSectionSelect("card-monitoring"),
        },
        "StudyNav: card monitoring",
      ),
    ),
}));

vi.mock("./pages/DashboardPage", async () => {
  const ReactModule = await import("react");
  const DashboardPage = ReactModule.forwardRef((
    props: {
      onOpenExamFromDatabaseRecord?: (target: { path: string; relativePath: string }) => void;
    },
    ref,
  ) => {
    ReactModule.useImperativeHandle(ref, () => ({
      requestVaultViewChange: (nextView: "markdown" | "exam") => {
        dashboardViewRequests.values.push(nextView);
      },
      requestLeaveDashboard: async () => {
        dashboardGuard.requests += 1;
        return dashboardGuard.canLeave;
      },
    }));
    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "div",
        { "data-testid": "mock-dashboard-page" },
        "Dashboard",
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          "data-testid": "mock-dashboard-open-exam-from-database",
          onClick: () =>
            props.onOpenExamFromDatabaseRecord?.({
              path: "/vault/exam-from-database.md",
              relativePath: "exam-from-database.md",
            }),
        },
        "Dashboard: open exam from database",
      ),
    );
  });
  DashboardPage.displayName = "MockDashboardPage";
  return { DashboardPage };
});

vi.mock("./pages/ExamSimulationPage", () => ({
  ExamSimulationPage: ({
    onOpenExamFileInMarkdownEditor,
    launchPreset,
  }: {
    onOpenExamFileInMarkdownEditor?: (
      file: { path: string; relative_path: string },
      options?: { openInNewTab?: boolean },
    ) => void;
    launchPreset?: { id: number; combinationMode: string } | null;
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
        "div",
        { "data-testid": "mock-exam-launch-preset" },
        launchPreset?.combinationMode ?? "none",
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
  FlashcardPage: () =>
    React.createElement("div", { "data-testid": "mock-flashcard-page" }, "Flashcard"),
}));

vi.mock("./pages/CardMonitoringPage", async () => {
  const ReactModule = await import("react");
  const CardMonitoringPage = ReactModule.forwardRef((_props, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({
      requestLeaveCardMonitoring: async () => {
        cardMonitoringGuard.requests += 1;
        return cardMonitoringGuard.canLeave;
      },
    }));
    return ReactModule.createElement(
      "div",
      { "data-testid": "mock-card-monitoring-page" },
      "Card Monitoring",
    );
  });
  CardMonitoringPage.displayName = "MockCardMonitoringPage";
  return { CardMonitoringPage };
});

vi.mock("./pages/PointsProfilesPage", () => ({
  PointsProfilesPage: () =>
    React.createElement(
      "div",
      { "data-testid": "mock-points-profiles-page" },
      "Points Profiles",
    ),
}));

vi.mock("./pages/FastFlashcardPage", () => ({
  FastFlashcardPage: () =>
    React.createElement("div", { "data-testid": "mock-fast-flashcard-page" }, "Fast"),
}));

vi.mock("./pages/SpacedRepetitionPage", () => ({
  SpacedRepetitionPage: () =>
    React.createElement("div", { "data-testid": "mock-sr-page" }, "SR"),
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
  requestSettingsFocus: vi.fn(),
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
    stageTaskAreaToggle: vi.fn(),
    getStagedTaskAreaToggle: vi.fn(() => null),
    getTaskAreaToggleNotice: vi.fn(() => ""),
    flushPendingTaskAreaToggles: vi.fn(async () => true),
    handleSelectFile: vi.fn(),
    handleSetSelectedExamFiles: vi.fn(),
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
    profileRootPath: "/user-vault",
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

const getSetSelectedExamFilesSpy = () =>
  (
    appStateHolder.value as {
      actions: { handleSetSelectedExamFiles: ReturnType<typeof vi.fn> };
    }
  ).actions.handleSetSelectedExamFiles;

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
    dashboardViewRequests.values = [];
    cardMonitoringGuard.canLeave = true;
    cardMonitoringGuard.requests = 0;
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

  it("flushes pending task-area toggles before leaving flashcard tab", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();
    const flushSpy = (
      appStateHolder.value as {
        actions: {
          flushPendingTaskAreaToggles: ReturnType<typeof vi.fn>;
        };
      }
    ).actions.flushPendingTaskAreaToggles;

    await clickTestId(container, "study-nav-switch-flashcard");
    expect(container.querySelector('[data-testid="mock-flashcard-page"]')).toBeTruthy();

    await clickTestId(container, "study-nav-switch-exam");

    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(flushSpy).toHaveBeenCalledWith("tab-change:flashcard->exam");
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
    expect(getSelectFileSpy()).toHaveBeenCalledWith(
      {
        path: "/vault/from-sidebar.md",
        relative_path: "from-sidebar.md",
      },
      undefined,
    );

    cleanup();
  });

  it("passes sidebar ctrl-open options when leave is confirmed", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "sidebar-select-file-new-tab");

    expect(dashboardGuard.requests).toBe(1);
    expect(getSelectFileSpy()).toHaveBeenCalledWith(
      {
        path: "/vault/from-sidebar-new-tab.md",
        relative_path: "from-sidebar-new-tab.md",
      },
      { openInNewTab: true },
    );

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

  it("opens dashboard exam editor directly from study nav without exam simulation toggle", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "study-nav-switch-exam");
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeTruthy();

    await clickTestId(container, "study-nav-open-editor-exam");

    expect(container.querySelector('[data-testid="mock-dashboard-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeNull();

    cleanup();
  });

  it("keeps exam editor target stable on repeated clicks (no markdown/exam toggle)", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "study-nav-open-editor-exam");
    await clickTestId(container, "study-nav-open-editor-exam");

    expect(dashboardViewRequests.values).toEqual(["exam", "exam"]);
    expect(container.querySelector('[data-testid="mock-dashboard-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeNull();

    cleanup();
  });

  it("opens exam from database row with single selection and nested launch preset", async () => {
    dashboardGuard.canLeave = true;
    const { container, cleanup } = renderApp();

    await clickTestId(container, "mock-dashboard-open-exam-from-database");
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-exam-launch-preset"]')?.textContent)
      .toBe("nested");
    expect(getSetSelectedExamFilesSpy()).toHaveBeenCalledWith([
      "/vault/exam-from-database.md",
    ]);

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

  it("blocks tab switches when card monitoring denies leave", async () => {
    const { container, cleanup } = renderApp();

    await clickTestId(container, "study-nav-switch-card-monitoring");
    expect(container.querySelector('[data-testid="mock-card-monitoring-page"]')).toBeTruthy();

    cardMonitoringGuard.requests = 0;
    cardMonitoringGuard.canLeave = false;

    await clickTestId(container, "study-nav-switch-exam");

    expect(cardMonitoringGuard.requests).toBe(1);
    expect(container.querySelector('[data-testid="mock-card-monitoring-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeNull();

    cleanup();
  });

  it("allows tab switches when card monitoring confirms leave", async () => {
    const { container, cleanup } = renderApp();

    await clickTestId(container, "sidebar-switch-card-monitoring");
    expect(container.querySelector('[data-testid="mock-card-monitoring-page"]')).toBeTruthy();

    cardMonitoringGuard.requests = 0;
    cardMonitoringGuard.canLeave = true;

    await clickTestId(container, "study-nav-switch-exam");

    expect(cardMonitoringGuard.requests).toBe(1);
    expect(container.querySelector('[data-testid="mock-exam-simulation-page"]')).toBeTruthy();

    cleanup();
  });
});
