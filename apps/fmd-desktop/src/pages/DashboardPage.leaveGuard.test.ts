// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { useAppState } from "../components/AppStateProvider";
import type { ExamEditorControlsState } from "./exam-editor/types";
import { useMediaQuery } from "../lib/useMediaQuery";

const examEditorMock = vi.hoisted(() => ({
  queue: [] as ExamEditorControlsState[],
}));
const capturedPreviewPanelProps = vi.hoisted(
  () => [] as Array<Record<string, unknown>>,
);

vi.mock("../components/AppStateProvider", () => ({
  useAppState: vi.fn(),
}));

vi.mock("../lib/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => false),
}));

vi.mock("../components/FileList", () => ({
  FileList: ({ onSelectFile }: { onSelectFile: (file: { path: string; relative_path: string }) => void }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": "mock-file-select",
        onClick: () =>
          onSelectFile({
            path: "/vault/target.md",
            relative_path: "target.md",
          }),
      },
      "Select file",
    ),
}));

vi.mock("../components/PreviewPanel", () => ({
  PreviewPanel: ({
    onOpenTaskProfileEditor,
    ...props
  }: {
    onOpenTaskProfileEditor?: (payload: {
      taskValue: string | null;
      propertyKey: string;
    }) => void;
  } & Record<string, unknown>) => {
    capturedPreviewPanelProps.push(props);
    return (
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": "mock-open-task-profile",
        onClick: () =>
          void onOpenTaskProfileEditor?.({
            taskValue: null,
            propertyKey: "task",
          }),
      },
      "Open task profile editor",
    )
    );
  },
}));

vi.mock("../components/ModalShell", () => ({
  ModalShell: ({
    isOpen,
    title,
    onClose,
    children,
  }: {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }) =>
    isOpen
      ? React.createElement(
          "div",
          { "data-testid": `modal:${title}` },
          React.createElement("h2", null, title),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": `modal-close:${title}`,
              onClick: onClose,
            },
            "Close",
          ),
          children,
        )
      : null,
}));

vi.mock("../components/NoteModal", () => ({
  NoteModal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? React.createElement("div", null, children) : null),
}));

vi.mock("./exam-editor/ExamEditorView", async () => {
  const ReactModule = await import("react");
  return {
    ExamEditorView: ({
      onControlsReady,
    }: {
      onControlsReady?: (controls: ExamEditorControlsState | null) => void;
    }) => {
      const controlsRef = ReactModule.useRef<ExamEditorControlsState | null>(null);
      if (!controlsRef.current) {
        controlsRef.current =
          examEditorMock.queue.shift() ??
          ({
            mode: "structure",
            canSave: true,
            isSaving: false,
            hasUnsavedChanges: false,
            savePath: null,
            saveState: "idle",
            validationSummary: null,
            onModeChange: vi.fn(),
            onNewExam: vi.fn(),
            onSaveAs: vi.fn(),
            onSave: vi.fn(),
            onSaveAndWait: vi.fn(async () => true),
            onQuickAddCard: vi.fn(),
          } satisfies ExamEditorControlsState);
      }
      const controls = controlsRef.current;
      ReactModule.useEffect(() => {
        onControlsReady?.(controls);
        return () => {
          onControlsReady?.(null);
        };
      }, [onControlsReady]);
      return React.createElement("div", { "data-testid": "mock-exam-editor-view" });
    },
  };
});

const mockUseAppState = vi.mocked(useAppState);
const mockUseMediaQuery = vi.mocked(useMediaQuery);
const invokeMock = vi.mocked(invoke);

const createExamControls = (
  overrides: Partial<ExamEditorControlsState> = {},
): ExamEditorControlsState => ({
  mode: "structure",
  canSave: true,
  isSaving: false,
  hasUnsavedChanges: false,
  savePath: null,
  saveState: "idle",
  validationSummary: null,
  onModeChange: vi.fn(),
  onNewExam: vi.fn(),
  onSaveAs: vi.fn(),
  onSave: vi.fn(),
  onSaveAndWait: vi.fn(async () => true),
  onQuickAddCard: vi.fn(),
  ...overrides,
});

const createMockAppState = ({
  handleSelectFile,
  selectedFile = { path: "/vault/source.md", relative_path: "source.md" },
  selectedFileOpenInNewTab = false,
  markdownEditorOpenInNewTabByDefault = false,
  previewMarkdown = "# demo",
  previewState = "idle",
  markdownViewEditEnabled = false,
}: {
  handleSelectFile: ReturnType<typeof vi.fn>;
  selectedFile?: { path: string; relative_path: string } | null;
  selectedFileOpenInNewTab?: boolean;
  markdownEditorOpenInNewTabByDefault?: boolean;
  previewMarkdown?: string;
  previewState?: "idle" | "loading" | "error";
  markdownViewEditEnabled?: boolean;
}) =>
  ({
    actions: {
      handleSelectFile,
      handleRescanVault: vi.fn(async () => false),
    },
    pointsProfiles: {
      profiles: [],
      selectedProfileId: null,
      defaultProfileId: null,
      resolveProfileByName: vi.fn(() => null),
      setSelectedProfileId: vi.fn(),
      createProfile: vi.fn(async () => ({ ok: true, profile: null })),
    },
    preview: {
      selectedFile,
      selectedFileOpenInNewTab,
      preview: previewMarkdown,
      previewState,
      previewError: "",
      rawPreview: false,
      setRawPreview: vi.fn(),
      setPreview: vi.fn(),
      resetPreview: vi.fn(),
    },
    settings: {
      markdownViewEditEnabled,
      markdownEditorAccentEnabled: false,
      accentColor: "#33aa77",
      theme: "light",
      markdownEditorAccentDarkHex: "#33aa77",
      markdownEditorAccentLightHex: "#33aa77",
      settingsLoaded: true,
      markdownPreviewDefaultMode: "markdown",
      markdownEditorOpenInNewTabByDefault,
      examEditorShowMoveButtons: false,
    },
    vault: {
      activeFolderPath: null,
      files: [
        { path: "/vault/source.md", relative_path: "source.md" },
        { path: "/vault/target.md", relative_path: "target.md" },
        { path: "/vault/third.md", relative_path: "third.md" },
      ],
      pngAssets: [],
      listError: "",
      listState: "idle",
      vaultPath: "/vault",
      setFiles: vi.fn(),
    },
  }) as unknown as ReturnType<typeof useAppState>;

const renderDashboard = ({
  initialVaultView = "exam",
  appState,
}: {
  initialVaultView?: "exam" | "markdown";
  appState?: ReturnType<typeof createMockAppState>;
} = {}) => {
  const fallbackHandleSelectFile = vi.fn();
  const resolvedAppState =
    appState ??
    createMockAppState({
      handleSelectFile: fallbackHandleSelectFile,
    });
  mockUseAppState.mockReturnValue(resolvedAppState);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      React.createElement(DashboardPage, {
        initialVaultView,
      }),
    );
  });

  return {
    container,
    handleSelectFile: resolvedAppState.actions.handleSelectFile as ReturnType<typeof vi.fn>,
    rerender: () => {
      act(() => {
        root.render(
          React.createElement(DashboardPage, {
            initialVaultView,
          }),
        );
      });
    },
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

const clickModalButtonByText = async (
  container: HTMLElement,
  modalTitle: string,
  label: string,
) => {
  const modal = container.querySelector<HTMLElement>(`[data-testid="modal:${modalTitle}"]`);
  expect(modal).toBeTruthy();
  const target = Array.from(modal?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
    (button) => button.textContent?.trim() === label,
  );
  expect(target).toBeTruthy();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const getLatestPreviewPanelProps = () =>
  capturedPreviewPanelProps[capturedPreviewPanelProps.length - 1];

describe("DashboardPage exam leave guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue("");
    examEditorMock.queue = [];
    capturedPreviewPanelProps.length = 0;
    mockUseMediaQuery.mockReturnValue(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it("blocks file switch on dirty exam when user cancels", async () => {
    examEditorMock.queue = [createExamControls({ hasUnsavedChanges: true })];
    const { container, handleSelectFile, cleanup } = renderDashboard({
      initialVaultView: "exam",
    });

    await clickTestId(container, "mock-file-select");
    expect(container.textContent).toContain("Unsaved changes");

    await clickModalButtonByText(container, "Unsaved changes", "Cancel");
    expect(handleSelectFile).not.toHaveBeenCalled();

    cleanup();
  });

  it("renders a full-width top toolbar in desktop exam view", () => {
    mockUseMediaQuery.mockReturnValue(true);
    examEditorMock.queue = [createExamControls()];
    const { container, cleanup } = renderDashboard({ initialVaultView: "exam" });

    const topToolbar = container.querySelector(".exam-editor-controls-panel-top");
    expect(topToolbar).toBeTruthy();
    expect(topToolbar?.textContent).toContain("New exam");
    expect(topToolbar?.textContent).toContain("Save as");
    expect(topToolbar?.textContent).toContain("Save");
    expect(topToolbar?.textContent).toContain("Structure");
    expect(topToolbar?.textContent).toContain("Content");
    expect(topToolbar?.textContent).toContain("Points");
    expect(topToolbar?.textContent).toContain("Saved path:");
    expect(container.querySelector(".note-column .exam-editor-controls-panel")).toBeFalsy();
    expect(container.querySelector(".right-overlay-rail.dashboard-overlay-rail")).toBeFalsy();
    expect(container.querySelector(".note-column")).toBeTruthy();
    expect(container.querySelector(".workspace")?.classList.contains("no-inline-note")).toBe(
      false,
    );
    expect(container.querySelectorAll('[data-testid="mock-file-select"]')).toHaveLength(1);

    cleanup();
  });

  it("uses inline note panel in desktop markdown view without overlay rail", () => {
    mockUseMediaQuery.mockReturnValue(true);
    const { container, cleanup } = renderDashboard({ initialVaultView: "markdown" });

    expect(container.querySelector(".right-overlay-rail.dashboard-overlay-rail")).toBeFalsy();
    expect(container.querySelector(".workspace")?.classList.contains("no-inline-note")).toBe(
      false,
    );
    expect(container.querySelectorAll('[data-testid="mock-file-select"]')).toHaveLength(1);

    cleanup();
  });

  it("keeps controls in the note column below desktop width", () => {
    examEditorMock.queue = [createExamControls()];
    const { container, cleanup } = renderDashboard({ initialVaultView: "exam" });

    expect(container.querySelector(".exam-editor-controls-panel-top")).toBeFalsy();
    expect(container.querySelector(".note-column .exam-editor-controls-panel")).toBeTruthy();
    expect(container.querySelector(".right-overlay-rail.dashboard-overlay-rail")).toBeFalsy();

    cleanup();
  });

  it("continues file switch on dirty exam when user discards", async () => {
    examEditorMock.queue = [createExamControls({ hasUnsavedChanges: true })];
    const { container, handleSelectFile, cleanup } = renderDashboard({
      initialVaultView: "exam",
    });

    await clickTestId(container, "mock-file-select");
    await clickModalButtonByText(container, "Unsaved changes", "Discard");

    expect(handleSelectFile).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("saves before file switch and proceeds only on successful save", async () => {
    const saveOk = vi.fn(async () => true);
    examEditorMock.queue = [
      createExamControls({
        hasUnsavedChanges: true,
        onSaveAndWait: saveOk,
      }),
    ];
    const firstRender = renderDashboard({ initialVaultView: "exam" });
    await clickTestId(firstRender.container, "mock-file-select");
    await clickModalButtonByText(firstRender.container, "Unsaved changes", "Save");
    expect(saveOk).toHaveBeenCalledTimes(1);
    expect(firstRender.handleSelectFile).toHaveBeenCalledTimes(1);
    firstRender.cleanup();

    const saveFail = vi.fn(async () => false);
    examEditorMock.queue = [
      createExamControls({
        hasUnsavedChanges: true,
        onSaveAndWait: saveFail,
      }),
    ];
    const secondRender = renderDashboard({ initialVaultView: "exam" });
    await clickTestId(secondRender.container, "mock-file-select");
    await clickModalButtonByText(secondRender.container, "Unsaved changes", "Save");
    expect(saveFail).toHaveBeenCalledTimes(1);
    expect(secondRender.handleSelectFile).not.toHaveBeenCalled();
    secondRender.cleanup();
  });

  it("guards closing the points profile modal with save/discard/cancel choices", async () => {
    const save = vi.fn(async () => true);
    examEditorMock.queue = [
      createExamControls({
        hasUnsavedChanges: true,
        onSaveAndWait: save,
      }),
    ];
    const { container, cleanup } = renderDashboard({
      initialVaultView: "markdown",
    });

    await clickTestId(container, "mock-open-task-profile");
    expect(container.textContent).toContain("Points Profile Editor");

    await clickTestId(container, "modal-close:Points Profile Editor");
    expect(container.textContent).toContain("Unsaved changes");

    await clickModalButtonByText(container, "Unsaved changes", "Cancel");
    expect(container.textContent).toContain("Points Profile Editor");

    await clickTestId(container, "modal-close:Points Profile Editor");
    await clickModalButtonByText(container, "Unsaved changes", "Discard");
    expect(container.textContent).not.toContain("Points Profile Editor");

    cleanup();
  });

  it("provides markdown tab session props to PreviewPanel", () => {
    const { cleanup } = renderDashboard({ initialVaultView: "markdown" });

    const latestProps = getLatestPreviewPanelProps();
    expect(latestProps).toBeTruthy();
    expect(latestProps?.markdownTabs).toEqual([
      {
        path: "/vault/source.md",
        relativePath: "source.md",
      },
    ]);
    expect(latestProps?.activeMarkdownTabPath).toBe("/vault/source.md");
    expect(typeof latestProps?.onSelectMarkdownTab).toBe("function");
    expect(typeof latestProps?.onCloseMarkdownTab).toBe("function");

    cleanup();
  });

  it("replaces the active markdown tab on standard selections", () => {
    const handleSelectFile = vi.fn();
    const initialState = createMockAppState({
      handleSelectFile,
      selectedFile: { path: "/vault/source.md", relative_path: "source.md" },
      selectedFileOpenInNewTab: false,
      markdownEditorOpenInNewTabByDefault: false,
    });
    const { rerender, cleanup } = renderDashboard({
      initialVaultView: "markdown",
      appState: initialState,
    });

    let latestProps = getLatestPreviewPanelProps();
    expect(latestProps?.markdownTabs).toEqual([
      { path: "/vault/source.md", relativePath: "source.md" },
    ]);

    mockUseAppState.mockReturnValue(
      createMockAppState({
        handleSelectFile,
        selectedFile: { path: "/vault/target.md", relative_path: "target.md" },
        selectedFileOpenInNewTab: false,
        markdownEditorOpenInNewTabByDefault: false,
      }),
    );
    rerender();

    latestProps = getLatestPreviewPanelProps();
    expect(latestProps?.markdownTabs).toEqual([
      { path: "/vault/target.md", relativePath: "target.md" },
    ]);

    cleanup();
  });

  it("appends a new markdown tab when ctrl/cmd open intent is set", () => {
    const handleSelectFile = vi.fn();
    const initialState = createMockAppState({
      handleSelectFile,
      selectedFile: { path: "/vault/source.md", relative_path: "source.md" },
      selectedFileOpenInNewTab: false,
      markdownEditorOpenInNewTabByDefault: false,
    });
    const { rerender, cleanup } = renderDashboard({
      initialVaultView: "markdown",
      appState: initialState,
    });

    mockUseAppState.mockReturnValue(
      createMockAppState({
        handleSelectFile,
        selectedFile: { path: "/vault/target.md", relative_path: "target.md" },
        selectedFileOpenInNewTab: true,
        markdownEditorOpenInNewTabByDefault: false,
      }),
    );
    rerender();

    const latestProps = getLatestPreviewPanelProps();
    expect(latestProps?.markdownTabs).toEqual([
      { path: "/vault/source.md", relativePath: "source.md" },
      { path: "/vault/target.md", relativePath: "target.md" },
    ]);

    cleanup();
  });

  it("appends tabs when markdown setting defaults to new-tab open", () => {
    const handleSelectFile = vi.fn();
    const initialState = createMockAppState({
      handleSelectFile,
      selectedFile: { path: "/vault/source.md", relative_path: "source.md" },
      selectedFileOpenInNewTab: false,
      markdownEditorOpenInNewTabByDefault: true,
    });
    const { rerender, cleanup } = renderDashboard({
      initialVaultView: "markdown",
      appState: initialState,
    });

    mockUseAppState.mockReturnValue(
      createMockAppState({
        handleSelectFile,
        selectedFile: { path: "/vault/target.md", relative_path: "target.md" },
        selectedFileOpenInNewTab: false,
        markdownEditorOpenInNewTabByDefault: true,
      }),
    );
    rerender();

    const latestProps = getLatestPreviewPanelProps();
    expect(latestProps?.markdownTabs).toEqual([
      { path: "/vault/source.md", relativePath: "source.md" },
      { path: "/vault/target.md", relativePath: "target.md" },
    ]);

    cleanup();
  });

  it("does not write markdown files while the selected file is still loading", async () => {
    const handleSelectFile = vi.fn();
    const sourceState = createMockAppState({
      handleSelectFile,
      selectedFile: { path: "/vault/source.md", relative_path: "source.md" },
      previewMarkdown: "Source content",
      previewState: "idle",
      markdownViewEditEnabled: true,
    });
    const { rerender, cleanup } = renderDashboard({
      initialVaultView: "markdown",
      appState: sourceState,
    });

    const sourceProps = getLatestPreviewPanelProps();
    const onEditChange = sourceProps?.onEditChange as ((value: string) => void) | undefined;
    expect(onEditChange).toBeTypeOf("function");
    act(() => {
      onEditChange?.("Source draft change");
    });

    invokeMock.mockClear();

    mockUseAppState.mockReturnValue(
      createMockAppState({
        handleSelectFile,
        selectedFile: { path: "/vault/target.md", relative_path: "target.md" },
        previewMarkdown: "",
        previewState: "loading",
        markdownViewEditEnabled: true,
      }),
    );
    rerender();

    const loadingProps = getLatestPreviewPanelProps();
    const onWriteSave = loadingProps?.onWriteSave as (() => Promise<void>) | undefined;
    expect(onWriteSave).toBeTypeOf("function");
    await act(async () => {
      await onWriteSave?.();
    });

    const writeCalls = invokeMock.mock.calls.filter(
      ([command]) => command === "write_text_file",
    );
    expect(writeCalls).toHaveLength(0);

    cleanup();
  });
});
