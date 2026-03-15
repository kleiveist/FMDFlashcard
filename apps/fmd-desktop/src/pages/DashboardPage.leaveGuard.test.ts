// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { useAppState } from "../components/AppStateProvider";
import type { ExamEditorControlsState } from "./exam-editor/types";

const examEditorMock = vi.hoisted(() => ({
  queue: [] as ExamEditorControlsState[],
}));

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
  }: {
    onOpenTaskProfileEditor?: (payload: {
      taskValue: string | null;
      propertyKey: string;
    }) => void;
  }) =>
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
    ),
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
}: {
  handleSelectFile: ReturnType<typeof vi.fn>;
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
      selectedFile: { path: "/vault/source.md", relative_path: "source.md" },
      preview: "# demo",
      previewState: "idle",
      previewError: "",
      rawPreview: false,
      setRawPreview: vi.fn(),
      setPreview: vi.fn(),
      resetPreview: vi.fn(),
    },
    settings: {
      markdownViewEditEnabled: false,
      markdownEditorAccentEnabled: false,
      accentColor: "#33aa77",
      theme: "light",
      markdownEditorAccentDarkHex: "#33aa77",
      markdownEditorAccentLightHex: "#33aa77",
      settingsLoaded: true,
      markdownPreviewDefaultMode: "markdown",
      examEditorShowMoveButtons: false,
    },
    vault: {
      activeFolderPath: null,
      files: [],
      pngAssets: [],
      listError: "",
      listState: "idle",
      vaultPath: "/vault",
      setFiles: vi.fn(),
    },
  }) as unknown as ReturnType<typeof useAppState>;

const renderDashboard = ({
  initialVaultView = "exam",
}: {
  initialVaultView?: "exam" | "markdown";
} = {}) => {
  const handleSelectFile = vi.fn();
  mockUseAppState.mockReturnValue(
    createMockAppState({
      handleSelectFile,
    }),
  );

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
    handleSelectFile,
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

describe("DashboardPage exam leave guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    examEditorMock.queue = [];
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
});
