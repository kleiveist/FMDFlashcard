// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/pages/help/sections/AppSectionsGuidePanel.test.tsx
 *
 * Zweck:
 * - Verifiziert die neue App-Sections-Struktur (Editor/Study/Monitoring)
 *   inklusive Sprachrendering und Hybrid-Action-Tabs.
 */

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AppSectionsGuidePanel } from "./AppSectionsGuidePanel";

const render = (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
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

const clickButtonByText = (container: HTMLElement, text: string) => {
  const target = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === text,
  );
  expect(target, `Missing button "${text}"`).toBeTruthy();
  act(() => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

describe("AppSectionsGuidePanel", () => {
  it("renders category hierarchy and switches section lists", () => {
    window.localStorage.clear();
    const { container, cleanup } = render(
      createElement(AppSectionsGuidePanel, {
        language: "en",
      }),
    );

    try {
      expect(container.textContent).toContain("Editor");
      expect(container.textContent).toContain("Study");
      expect(container.textContent).toContain("Monitoring");

      const initialCards = container.querySelectorAll(".help-syntax-cards .help-syntax-card");
      expect(initialCards).toHaveLength(5);
      expect(container.textContent).toContain("Markdown View Modus");
      expect(container.textContent).toContain("Markdown Hybrid Editor");

      clickButtonByText(container, "Study");
      const studyCards = container.querySelectorAll(".help-syntax-cards .help-syntax-card");
      expect(studyCards).toHaveLength(4);
      expect(container.textContent).toContain("Exam");
      expect(container.textContent).toContain("Flashcard");
      expect(container.textContent).toContain("Fast Flashcard");
      expect(container.textContent).toContain("Repetition");

      clickButtonByText(container, "Monitoring");
      const monitoringCards = container.querySelectorAll(".help-syntax-cards .help-syntax-card");
      expect(monitoringCards).toHaveLength(2);
      expect(container.textContent).toContain("Card Monitoring");
      expect(container.textContent).toContain("Points Profiles");
    } finally {
      cleanup();
    }
  });

  it("renders detail labels in the active UI language", () => {
    window.localStorage.clear();
    const german = render(
      createElement(AppSectionsGuidePanel, {
        language: "de",
      }),
    );

    try {
      expect(german.container.textContent).toContain("Was ist das?");
      expect(german.container.textContent).toContain("Wofür ist es?");
      expect(german.container.textContent).toContain("Kernablauf");
      const languageToggle = Array.from(
        german.container.querySelectorAll<HTMLButtonElement>("button"),
      ).find((button) => {
        const text = button.textContent?.trim();
        return text === "EN" || text === "DE";
      });
      expect(languageToggle).toBeUndefined();
    } finally {
      german.cleanup();
    }

    window.localStorage.clear();
    const english = render(
      createElement(AppSectionsGuidePanel, {
        language: "en",
      }),
    );

    try {
      expect(english.container.textContent).toContain("What is it?");
      expect(english.container.textContent).toContain("What is it for?");
      expect(english.container.textContent).toContain("Core workflow");
    } finally {
      english.cleanup();
    }
  });

  it("shows hybrid action buttons and switches their detail copy", () => {
    window.localStorage.clear();
    const { container, cleanup } = render(
      createElement(AppSectionsGuidePanel, {
        language: "en",
      }),
    );

    try {
      clickButtonByText(container, "Markdown Hybrid Editor");

      expect(container.textContent).toContain("+ Actions");
      expect(container.textContent).toContain("Selected Text");
      expect(container.textContent).toContain("Context Actions");
      expect(container.textContent).toContain(
        "The + menu inserts new blocks above or below the current block.",
      );

      clickButtonByText(container, "Selected Text");
      expect(container.textContent).toContain(
        "When text is selected, a floating inline toolbar appears.",
      );

      clickButtonByText(container, "Context Actions");
      expect(container.textContent).toContain(
        "Context actions depend on block type and cursor state.",
      );
    } finally {
      cleanup();
    }
  });
});
