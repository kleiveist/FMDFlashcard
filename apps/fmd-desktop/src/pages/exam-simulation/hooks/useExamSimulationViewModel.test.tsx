// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useAppState } from "../../../components/AppStateProvider";
import type { ExamFileEntry } from "../../../features/exam/types";
import type { ExamPointsProfile } from "../../../lib/exam/pointsProfiles";
import {
  buildExamSelectionRowsFromPaths,
  flattenExamSelectionRows,
  type ExamSelectionRows,
} from "../../../lib/examSelectionRows";
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

type InvokeArgs = Parameters<typeof invoke>[1];

type ExamSimulationViewModelSnapshot = {
  selectedRunProfileId: string | null;
  plannedTaskCount: number;
  plannedMaxPoints: number;
  previewDurationMinutes: number;
  handleRunProfileChange: (profileId: string | null) => void;
  handleCombinationModeChange: (
    mode: "fully-mixed" | "sequential" | "sequential-shuffled" | "nested",
  ) => void;
};

type HookState = ExamSimulationViewModelSnapshot | null;

const resolveInvokePath = (args?: InvokeArgs) => {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return "";
  }
  const candidate = (args as { path?: unknown }).path;
  return typeof candidate === "string" ? candidate : "";
};

const Probe = ({
  onValue,
}: {
  onValue: (value: ExamSimulationViewModelSnapshot) => void;
}) => {
  onValue(useExamSimulationViewModel() as ExamSimulationViewModelSnapshot);
  return null;
};

const renderHook = (onValue: (value: ExamSimulationViewModelSnapshot) => void) => {
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

const createProfile = (
  id: string,
  name: string,
  options?: {
    durationMinutes?: number;
    taskCount?: number;
    taskPoints?: number[];
  },
): ExamPointsProfile => {
  const now = new Date().toISOString();
  const taskCount = options?.taskCount ?? 5;
  const taskPoints = options?.taskPoints ?? [4, 4, 4, 4, 4];
  return {
    id,
    name,
    distribution: "task-order",
    durationMinutes: options?.durationMinutes ?? 45,
    maxTotalPoints: 20,
    taskCount,
    taskPoints: [
      ...taskPoints,
      ...Array.from({ length: Math.max(0, 20 - taskPoints.length) }, () => 0),
    ],
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

const createExamMarkdown = ({
  taskProfileName,
  taskCount = 3,
}: {
  taskProfileName?: string;
  taskCount?: number;
}) => {
  const lines: string[] = [];
  if (typeof taskProfileName === "string") {
    lines.push("---");
    lines.push(`Task: '${taskProfileName}'`);
    lines.push("---");
  }
  lines.push("#exam");
  for (let index = 1; index <= taskCount; index += 1) {
    lines.push(`${index}) Question ${index}`);
    lines.push("Answer: A");
    if (index < taskCount) {
      lines.push("---");
    }
  }
  lines.push("#endexam");
  return lines.join("\n");
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

const createMockAppState = ({
  selectedPaths,
  selectedRows,
  profileOne = createProfile("profile-1", "Profile 1"),
  profileTwo = createProfile("profile-2", "Profile 2"),
}: {
  selectedPaths: string[];
  selectedRows?: ExamSelectionRows;
  profileOne?: ExamPointsProfile;
  profileTwo?: ExamPointsProfile;
}) => {
  const normalizedRows = selectedRows ?? buildExamSelectionRowsFromPaths(selectedPaths);
  const normalizedPaths = flattenExamSelectionRows(normalizedRows);
  const profiles = [profileOne, profileTwo];
  const resolveProfileByName = (name: string | null | undefined) => {
    if (!name || !name.trim()) {
      return null;
    }
    const normalized = name.trim().toLocaleLowerCase();
    return (
      profiles.find((profile) => profile.name.trim().toLocaleLowerCase() === normalized) ??
      null
    );
  };
  return {
    actions: {
      handleToggleExamFileSelection: vi.fn(),
      handleSetSelectedExamFiles: vi.fn(),
      handleSetSelectedExamFileRows: vi.fn(),
      handlePlaceSelectedExamFile: vi.fn(),
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
      profiles,
      resolveProfileByName,
      resolveAssignedProfile: (name: string | null | undefined) => {
        const trimmed = typeof name === "string" ? name.trim() : "";
        if (!trimmed) {
          return {
            requestedName: null,
            profile: profileOne,
            missing: false,
          };
        }
        const profile = resolveProfileByName(trimmed);
        return {
          requestedName: trimmed,
          profile,
          missing: !profile,
        };
      },
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
    selectedExamFileRows: normalizedRows,
    selectedExamFilePaths: normalizedPaths,
  } as unknown as ReturnType<typeof useAppState>;
};

describe("useExamSimulationViewModel task profile matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRunProfileLargeSelectionAutoResetForTests();
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === "load_exam_run_data") {
        return { runs: [] };
      }
      if (command === "read_text_file") {
        return createExamMarkdown({});
      }
      return undefined;
    });
  });

  it("auto-sets by matrix on state changes and does not reset on pure manual selection", async () => {
    const readByPath: Record<string, string> = {
      "/vault/a.md": createExamMarkdown({ taskProfileName: "Profile 2" }),
      "/vault/b.md": createExamMarkdown({ taskProfileName: "Profile 2" }),
    };
    mockInvoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "load_exam_run_data") {
        return { runs: [] };
      }
      if (command === "read_text_file") {
        return readByPath[resolveInvokePath(args)] ?? createExamMarkdown({});
      }
      return undefined;
    });

    const state = createMockAppState({
      selectedPaths: ["/vault/a.md", "/vault/b.md"],
    });
    mockUseAppState.mockImplementation(() => state);

    let latest: HookState = null;
    const latestValue = (): HookState => latest;
    const { rerender, cleanup } = renderHook((value) => {
      latest = value;
    });

    await flush();
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBeNull();

    act(() => {
      latestValue()?.handleRunProfileChange("profile-1");
    });
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBe("profile-1");

    rerender();
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBe("profile-1");

    act(() => {
      latestValue()?.handleCombinationModeChange("nested");
    });
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBe("profile-2");

    act(() => {
      latestValue()?.handleRunProfileChange("profile-1");
    });
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBe("profile-1");

    rerender();
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBe("profile-1");

    cleanup();
  });

  it("treats unknown Task frontmatter as standard fallback in single selection", async () => {
    const readByPath: Record<string, string> = {
      "/vault/a.md": createExamMarkdown({ taskProfileName: "Unknown Profile" }),
    };
    mockInvoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "load_exam_run_data") {
        return { runs: [] };
      }
      if (command === "read_text_file") {
        return readByPath[resolveInvokePath(args)] ?? createExamMarkdown({});
      }
      return undefined;
    });

    const state = createMockAppState({
      selectedPaths: ["/vault/a.md"],
    });
    mockUseAppState.mockImplementation(() => state);

    let latest: HookState = null;
    const latestValue = (): HookState => latest;
    const { cleanup } = renderHook((value) => {
      latest = value;
    });

    await flush();
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBeNull();

    cleanup();
  });

  it("uses source-reset task-order scoring with overflow fallback and mode-based duration", async () => {
    const profileOne = createProfile("profile-1", "Profile 1", {
      durationMinutes: 30,
      taskCount: 5,
      taskPoints: [2, 2, 2, 2, 2],
    });
    const profileTwo = createProfile("profile-2", "Profile 2", {
      durationMinutes: 7,
      taskCount: 2,
      taskPoints: [10, 20],
    });
    const readByPath: Record<string, string> = {
      "/vault/a.md": createExamMarkdown({ taskProfileName: "Profile 2", taskCount: 3 }),
      "/vault/b.md": createExamMarkdown({ taskProfileName: "Profile 2", taskCount: 3 }),
    };
    mockInvoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "load_exam_run_data") {
        return { runs: [] };
      }
      if (command === "read_text_file") {
        return readByPath[resolveInvokePath(args)] ?? createExamMarkdown({});
      }
      return undefined;
    });

    const state = createMockAppState({
      selectedPaths: ["/vault/a.md", "/vault/b.md"],
      profileOne,
      profileTwo,
    });
    mockUseAppState.mockImplementation(() => state);

    let latest: HookState = null;
    const latestValue = (): HookState => latest;
    const { cleanup } = renderHook((value) => {
      latest = value;
    });

    await flush();
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBeNull();

    act(() => {
      latestValue()?.handleRunProfileChange("profile-2");
    });
    await flush();

    expect(latestValue()?.selectedRunProfileId).toBe("profile-2");
    expect(latestValue()?.plannedTaskCount).toBe(6);
    expect(latestValue()?.plannedMaxPoints).toBe(62);
    expect(latestValue()?.previewDurationMinutes).toBe(14);

    act(() => {
      latestValue()?.handleCombinationModeChange("nested");
    });
    await flush();

    expect(latestValue()?.selectedRunProfileId).toBe("profile-2");
    expect(latestValue()?.plannedTaskCount).toBe(3);
    expect(latestValue()?.plannedMaxPoints).toBe(31);
    expect(latestValue()?.previewDurationMinutes).toBe(7);

    cleanup();
  });

  it("multiplies nested profile duration by non-empty row count", async () => {
    const profileOne = createProfile("profile-1", "Profile 1", {
      durationMinutes: 30,
      taskCount: 5,
      taskPoints: [2, 2, 2, 2, 2],
    });
    const profileTwo = createProfile("profile-2", "Profile 2", {
      durationMinutes: 7,
      taskCount: 3,
      taskPoints: [10, 20, 30],
    });
    const readByPath: Record<string, string> = {
      "/vault/a.md": createExamMarkdown({ taskProfileName: "Profile 2", taskCount: 3 }),
      "/vault/b.md": createExamMarkdown({ taskProfileName: "Profile 2", taskCount: 3 }),
      "/vault/c.md": createExamMarkdown({ taskProfileName: "Profile 2", taskCount: 3 }),
    };
    mockInvoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "load_exam_run_data") {
        return { runs: [] };
      }
      if (command === "read_text_file") {
        return readByPath[resolveInvokePath(args)] ?? createExamMarkdown({});
      }
      return undefined;
    });

    const state = createMockAppState({
      selectedPaths: ["/vault/a.md", "/vault/b.md", "/vault/c.md"],
      selectedRows: [["/vault/a.md"], ["/vault/b.md", "/vault/c.md"]],
      profileOne,
      profileTwo,
    });
    mockUseAppState.mockImplementation(() => state);

    let latest: HookState = null;
    const latestValue = (): HookState => latest;
    const { cleanup } = renderHook((value) => {
      latest = value;
    });

    await flush();
    await flush();
    expect(latestValue()?.selectedRunProfileId).toBeNull();

    act(() => {
      latestValue()?.handleRunProfileChange("profile-2");
      latestValue()?.handleCombinationModeChange("nested");
    });
    await flush();

    expect(latestValue()?.previewDurationMinutes).toBe(14);

    cleanup();
  });
});
