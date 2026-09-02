// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudySectionNav } from "./StudySectionNav";
import type { StudyMainMode, StudySectionKey } from "../lib/studySections";
import type { DashboardView } from "../pages/dashboardPreviewMode";

type RenderOptions = {
  activeTab?: StudySectionKey;
  activeMainMode?: StudyMainMode;
  activeDashboardView?: DashboardView;
  onMainModeSelect?: (mode: StudyMainMode) => void;
  onSectionSelect?: (tab: StudySectionKey) => void;
  onDashboardViewSelect?: (view: DashboardView) => void;
  showSettingsAction?: boolean;
  onSettingsAction?: () => void;
  settingsActionLabel?: string;
};

const findButtonByExactText = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label,
  );

const clickButtonByExactText = async (container: HTMLElement, label: string) => {
  const button = findButtonByExactText(container, label);
  expect(button).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const renderStudySectionNav = ({
  activeTab = "dashboard",
  activeMainMode = "study",
  activeDashboardView = "markdown",
  onMainModeSelect = vi.fn(),
  onSectionSelect = vi.fn(),
  onDashboardViewSelect = vi.fn(),
  showSettingsAction = false,
  onSettingsAction = vi.fn(),
  settingsActionLabel = "Settings",
}: RenderOptions = {}) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <StudySectionNav
        activeTab={activeTab}
        activeMainMode={activeMainMode}
        activeDashboardView={activeDashboardView}
        onMainModeSelect={onMainModeSelect}
        onSectionSelect={onSectionSelect}
        onDashboardViewSelect={onDashboardViewSelect}
        isMobileNavOpen={false}
        onMobileNavOpen={vi.fn()}
        showNoteAction
        onNoteAction={vi.fn()}
        showSettingsAction={showSettingsAction}
        onSettingsAction={onSettingsAction}
        settingsActionLabel={settingsActionLabel}
      />,
    );
  });

  return {
    container,
    onMainModeSelect,
    onSectionSelect,
    onDashboardViewSelect,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

describe("StudySectionNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders primary row and keeps secondary row hidden initially", () => {
    const { container, cleanup } = renderStudySectionNav();

    expect(findButtonByExactText(container, "Editor")).toBeTruthy();
    expect(findButtonByExactText(container, "Study")).toBeTruthy();
    expect(findButtonByExactText(container, "Monitoring")).toBeTruthy();
    expect(findButtonByExactText(container, "Markdown Editor")).toBeUndefined();
    expect(findButtonByExactText(container, "Exam Editor")).toBeUndefined();

    cleanup();
  });

  it("shows study secondary items after clicking the Study primary button", async () => {
    const { container, cleanup } = renderStudySectionNav();

    await clickButtonByExactText(container, "Study");

    expect(findButtonByExactText(container, "Exam")).toBeTruthy();
    expect(findButtonByExactText(container, "Flashcard")).toBeTruthy();
    expect(findButtonByExactText(container, "Fast Flashcard")).toBeTruthy();
    expect(findButtonByExactText(container, "Repetition")).toBeTruthy();

    cleanup();
  });

  it("routes editor submenu clicks to explicit dashboard views", async () => {
    const onDashboardViewSelect = vi.fn();
    const { container, cleanup } = renderStudySectionNav({
      onDashboardViewSelect,
    });

    await clickButtonByExactText(container, "Editor");
    await clickButtonByExactText(container, "Markdown Editor");
    await clickButtonByExactText(container, "Exam Editor");

    expect(onDashboardViewSelect).toHaveBeenNthCalledWith(1, "markdown");
    expect(onDashboardViewSelect).toHaveBeenNthCalledWith(2, "exam");

    cleanup();
  });

  it("routes study and monitoring submenu clicks to section tabs", async () => {
    const onSectionSelect = vi.fn();
    const onMainModeSelect = vi.fn();
    const { container, cleanup } = renderStudySectionNav({
      onMainModeSelect,
      onSectionSelect,
    });

    await clickButtonByExactText(container, "Study");
    await clickButtonByExactText(container, "Flashcard");
    await clickButtonByExactText(container, "Monitoring");
    await clickButtonByExactText(container, "Attribute Rules");
    await clickButtonByExactText(container, "Points Profiles");

    expect(onMainModeSelect).toHaveBeenNthCalledWith(1, "study");
    expect(onMainModeSelect).toHaveBeenNthCalledWith(2, "monitoring");
    expect(onSectionSelect).toHaveBeenNthCalledWith(1, "flashcard");
    expect(onSectionSelect).toHaveBeenNthCalledWith(2, "monitoring-rules");
    expect(onSectionSelect).toHaveBeenNthCalledWith(3, "points-profiles");

    cleanup();
  });

  it("shows Attribute Rules as first monitoring sub-item", async () => {
    const { container, cleanup } = renderStudySectionNav();

    await clickButtonByExactText(container, "Monitoring");
    const secondaryButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button.study-section-secondary-tab"),
    ).map((button) => button.textContent?.trim() ?? "");
    expect(secondaryButtons.slice(0, 3)).toEqual([
      "Attribute Rules",
      "Card Monitoring",
      "Points Profiles",
    ]);

    cleanup();
  });

  it("renders and triggers settings action when configured", async () => {
    const onSettingsAction = vi.fn();
    const { container, cleanup } = renderStudySectionNav({
      showSettingsAction: true,
      onSettingsAction,
      settingsActionLabel: "Flashcard Tools",
    });

    const settingsButton = container.querySelector<HTMLButtonElement>(
      'button.study-section-settings-toggle[aria-label="Flashcard Tools"]',
    );
    expect(settingsButton).toBeTruthy();

    await act(async () => {
      settingsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onSettingsAction).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
