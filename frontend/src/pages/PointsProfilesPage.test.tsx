// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { PointsProfilesPage } from "./PointsProfilesPage";
import { useAppState } from "../components/AppStateProvider";

vi.mock("../components/AppStateProvider", () => ({
  useAppState: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockUseAppState = vi.mocked(useAppState);
const mockInvoke = vi.mocked(invoke);

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const createPointsProfilesMock = () => {
  const profiles = [
    {
      id: "profile-exam",
      name: "Exam",
      distribution: "task-order",
      durationMinutes: 45,
      maxTotalPoints: 20,
      taskCount: 5,
      taskPoints: Array.from({ length: 30 }, (_, index) => (index < 5 ? 4 : 0)),
      typeRules: {
        qa: { points: 1, mode: "all-or-nothing", penalty: 0 },
        "multiple-choice": { points: 1, mode: "all-or-nothing", penalty: 0 },
        "fill-blank": { points: 1, mode: "all-or-nothing", penalty: 0 },
        assignment: { points: 1, mode: "all-or-nothing", penalty: 0 },
        "true-false": { points: 1, mode: "all-or-nothing", penalty: 0 },
      },
      createdAt: "",
      updatedAt: "",
      version: 1,
    },
  ];

  const resolveProfileByName = vi.fn((name: string | null | undefined) => {
    const normalized = (name ?? "").trim().toLowerCase();
    return profiles.find((profile) => profile.name.toLowerCase() === normalized) ?? null;
  });
  const firstProfile = profiles[0]!;

  return {
    profiles,
    loading: false,
    saving: false,
    error: "",
    defaultProfileId: firstProfile.id,
    defaultProfile: firstProfile,
    selectedProfileId: firstProfile.id,
    selectedProfile: firstProfile,
    setSelectedProfileId: vi.fn(),
    resolveProfileByName,
    resolveAssignedProfile: vi.fn(),
    createProfile: vi.fn(async () => ({ ok: true, error: null, profile: firstProfile })),
    renameProfile: vi.fn(async () => ({ ok: true, error: null, profile: firstProfile })),
    updateProfile: vi.fn(async () => ({ ok: true, error: null, profile: firstProfile })),
    deleteProfile: vi.fn(async () => ({ ok: true, error: null, profile: firstProfile })),
    setDefaultProfileId: vi.fn(async () => true),
    saveNow: vi.fn(async () => true),
  };
};

const renderPage = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(PointsProfilesPage));
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

describe("PointsProfilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows monitoring counts and opens assigned file lists in a popup", async () => {
    const pointsProfiles = createPointsProfilesMock();

    mockUseAppState.mockReturnValue({
      pointsProfiles,
      vault: {
        vaultPath: "/vault",
        files: [
          { path: "/vault/folder/exam.md", relative_path: "folder/exam.md" },
          { path: "/vault/unknown.md", relative_path: "unknown.md" },
        ],
      },
    } as unknown as ReturnType<typeof useAppState>);

    mockInvoke.mockImplementation(async (command, args) => {
      const payload =
        args && typeof args === "object" && !Array.isArray(args)
          ? (args as Record<string, unknown>)
          : {};
      if (command !== "read_text_file") {
        return null;
      }
      const path = String(payload.path ?? "");
      if (path.endsWith("/folder/exam.md")) {
        return ["---", "Task: Exam", "---", "# doc"].join("\n");
      }
      if (path.endsWith("/unknown.md")) {
        return ["---", "Task: MissingProfile", "---", "# doc"].join("\n");
      }
      return "";
    });

    const { container, cleanup } = renderPage();
    await flush();

    expect(container.textContent).toContain("Monitoring");
    expect(container.textContent).toContain("Exam");
    expect(container.textContent).toContain("Missing profile: MissingProfile");

    const usageButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".points-profile-monitoring-toggle"),
    ).find((entry) => entry.textContent?.includes("Exam"));
    expect(usageButton).toBeTruthy();

    await act(async () => {
      usageButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(document.querySelector(".points-profile-monitoring-popup")).toBeTruthy();
    expect(document.body.textContent).toContain("folder/exam.md");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector(".points-profile-monitoring-popup")).toBeNull();

    await act(async () => {
      usageButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const backdrop = document.querySelector<HTMLDivElement>(".anchored-popup-backdrop");
    expect(backdrop).toBeTruthy();
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    });
    expect(document.querySelector(".points-profile-monitoring-popup")).toBeNull();

    await act(async () => {
      usageButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const closeButton = document.querySelector<HTMLButtonElement>(
      ".points-profile-monitoring-popup .anchored-popup-close",
    );
    expect(closeButton).toBeTruthy();
    act(() => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(document.querySelector(".points-profile-monitoring-popup")).toBeNull();

    cleanup();
  });

  it("uses task count max 30 in the profile editor", async () => {
    const pointsProfiles = createPointsProfilesMock();

    mockUseAppState.mockReturnValue({
      pointsProfiles,
      vault: {
        vaultPath: null,
        files: [],
      },
    } as unknown as ReturnType<typeof useAppState>);

    mockInvoke.mockResolvedValue("");

    const { container, cleanup } = renderPage();
    await flush();

    const taskCountInput = container.querySelector<HTMLInputElement>(
      'input[type="number"][min="1"][max="30"]',
    );
    expect(taskCountInput).toBeTruthy();

    cleanup();
  });
});
