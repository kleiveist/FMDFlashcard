// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudySectionNav } from "./StudySectionNav";
import type { StudySectionKey } from "../lib/studySections";
import type { DashboardView } from "../pages/dashboardPreviewMode";

type RenderOptions = {
  activeTab?: StudySectionKey;
  activeDashboardView?: DashboardView;
  onSectionSelect?: (tab: StudySectionKey) => void;
  onDashboardViewSelect?: (view: DashboardView) => void;
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
  activeDashboardView = "markdown",
  onSectionSelect = vi.fn(),
  onDashboardViewSelect = vi.fn(),
}: RenderOptions = {}) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <StudySectionNav
        activeTab={activeTab}
        activeDashboardView={activeDashboardView}
        onSectionSelect={onSectionSelect}
        onDashboardViewSelect={onDashboardViewSelect}
        isMobileNavOpen={false}
        onMobileNavOpen={vi.fn()}
        showNoteAction
        onNoteAction={vi.fn()}
      />,
    );
  });

  return {
    container,
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
    const { container, cleanup } = renderStudySectionNav({
      onSectionSelect,
    });

    await clickButtonByExactText(container, "Study");
    await clickButtonByExactText(container, "Flashcard");
    await clickButtonByExactText(container, "Monitoring");
    await clickButtonByExactText(container, "Points Profiles");

    expect(onSectionSelect).toHaveBeenNthCalledWith(1, "flashcard");
    expect(onSectionSelect).toHaveBeenNthCalledWith(2, "points-profiles");

    cleanup();
  });
});
