// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useAppState } from "../../../components/AppStateProvider";
import type { ExamFileEntry } from "../../../features/exam/types";
import type { ExamPointsProfile } from "../../../lib/exam/pointsProfiles";
import {
  __resetRunProfileLargeSelectionAutoResetForTests,
  useExamSimulationViewModel,
} from "./useExamSimulationViewModel";

vi.mock("../../../components/AppStateProvider", () => ({
  useAppState: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockUseAppState = vi.mocked(useAppState);
const mockInvoke = vi.mocked(invoke);

type HookState = ReturnType<typeof useExamSimulationViewModel> | null;

const Probe = ({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useExamSimulationViewModel>) => void;
}) => {
  onValue(useExamSimulationViewModel());
  return null;
};

const renderHook = (onValue: (value: ReturnType<typeof useExamSimulationViewModel>) => void) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const rerender = () => {
    act(() => {
      root.render(createElement(Probe, { onValue }));
    });
  };

  rerender();

  return {
    rerender,
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
  });
};

const basePointsMap = {
  qa: 1,
  tf: 1,
  m1: 1,
  m2: 1,
  cl: 1,
  cd: 1,
  cld: 1,
};

const createProfile = (id: string, name: string): ExamPointsProfile => {
  const now = new Date().toISOString();
  return {
    id,
    name,
    distribution: "task-order",
    durationMinutes: 45,
    maxTotalPoints: 20,
    taskCount: 5,
    taskPoints: [4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    typeRules: {
      qa: { points: 1, mode: "all-or-nothing", penalty: 0 },
      tf: { points: 1, mode: "all-or-nothing", penalty: 0 },
      m1: { points: 1, mode: "all-or-nothing", penalty: 0 },
      m2: { points: 1, mode: "all-or-nothing", penalty: 0 },
      cl: { points: 1, mode: "all-or-nothing", penalty: 0 },
      cd: { points: 1, mode: "all-or-nothing", penalty: 0 },
      cld: { points: 1, mode: "all-or-nothing", penalty: 0 },
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
};

const examFiles: ExamFileEntry[] = [
  {
    path: "/vault/a.md",
    relative_path: "a.md",
    status: "valid",
    taskCount: 3,
    hasExamBlock: true,
    error: null,
  },
  {
    path: "/vault/b.md",
    relative_path: "b.md",
    status: "valid",
    taskCount: 3,
    hasExamBlock: true,
    error: null,
  },
  {
    path: "/vault/c.md",
    relative_path: "c.md",
    status: "valid",
    taskCount: 3,
    hasExamBlock: true,
    error: null,
  },
];

const createMockAppState = (selectedPaths: string[]) => {
  const profileOne = createProfile("profile-1", "Profile 1");
  const profileTwo = createProfile("profile-2", "Profile 2");
  return {
    actions: {
      handleToggleExamFileSelection: vi.fn(),
      handleSetSelectedExamFiles: vi.fn(),
      handleClearSelectedExamFiles: vi.fn(),
      handleMoveSelectedExamFile: vi.fn(),
      handleRescanVault: vi.fn().mockResolvedValue(true),
    },
    preview: {
      selectedFile: null,
      setPreview: vi.fn(),
    },
    settings: {
      examTaskTypeDefaultPoints: basePointsMap,
      examTaskTypeDefaultTimeSeconds: basePointsMap,
      examTimeLimitEnabled: false,
      examShowTimeline: false,
      examAiEvaluation: {
        enabled: false,
        provider: null,
      },
      examGradeScale: "standard-1-6",
    },
    pointsProfiles: {
      loading: false,
      defaultProfileId: profileOne.id,
      defaultProfile: profileOne,
      profiles: [profileOne, profileTwo],
    },
    spacedRepetition: {
      spacedRepetitionActiveUserId: "user-1",
      spacedRepetitionActiveUser: "User",
    },
    userVault: {
      activeProfilePath: null,
      revision: 0,
    },
    vault: {
      vaultPath: "/vault",
      pngAssets: [],
    },
    examFiles,
    examFilesState: "idle",
    examFilesError: "",
    selectedExamFilePaths: selectedPaths,
  } as unknown as ReturnType<typeof useAppState>;
};

describe("useExamSimulationViewModel run profile auto reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRunProfileLargeSelectionAutoResetForTests();
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === "load_exam_run_data") {
        return { runs: [] };
      }
      if (command === "read_text_file") {
        return "#exam\n1) Sample\n#endexam";
      }
      return undefined;
    });
  });

  it("resets to standard once when selection grows beyond two and keeps later manual override", async () => {
    const state = createMockAppState(["/vault/a.md", "/vault/b.md"]);
    mockUseAppState.mockImplementation(() => state);

    let latest: HookState = null;
    const { rerender, cleanup } = renderHook((value) => {
      latest = value;
    });

    await flush();
    await flush();
    expect(latest?.selectedRunProfileId).toBe("profile-1");

    state.selectedExamFilePaths = ["/vault/a.md", "/vault/b.md", "/vault/c.md"];
    rerender();
    await flush();
    expect(latest?.selectedRunProfileId).toBeNull();

    act(() => {
      latest?.handleRunProfileChange("profile-2");
    });
    await flush();
    expect(latest?.selectedRunProfileId).toBe("profile-2");

    state.selectedExamFilePaths = ["/vault/a.md", "/vault/b.md"];
    rerender();
    await flush();
    state.selectedExamFilePaths = ["/vault/a.md", "/vault/b.md", "/vault/c.md"];
    rerender();
    await flush();
    expect(latest?.selectedRunProfileId).toBe("profile-2");

    cleanup();
  });

  it("keeps standard on initial mount when more than two files are already selected", async () => {
    const state = createMockAppState(["/vault/a.md", "/vault/b.md", "/vault/c.md"]);
    mockUseAppState.mockImplementation(() => state);

    let latest: HookState = null;
    const { cleanup } = renderHook((value) => {
      latest = value;
    });

    await flush();
    await flush();
    expect(latest?.selectedRunProfileId).toBeNull();

    cleanup();
  });
});
