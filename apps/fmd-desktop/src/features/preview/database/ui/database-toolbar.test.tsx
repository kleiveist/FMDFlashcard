// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DatabaseToolbar } from "./database-toolbar";

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

const buildProps = () => ({
  title: "Exam Uebersicht",
  sourceLabel: "Quelle: aktueller Ordner",
  viewType: "table" as const,
  searchQuery: "",
  showSearch: true,
  onTitleChange: vi.fn(),
  onTitleBlur: vi.fn(),
  onSearchChange: vi.fn(),
  onViewTypeChange: vi.fn(),
  isSourcePanelOpen: false,
  isFilterPanelOpen: false,
  isSortPanelOpen: false,
  isPropertiesPanelOpen: false,
  onToggleSourcePanel: vi.fn(),
  onToggleFilterPanel: vi.fn(),
  onToggleSortPanel: vi.fn(),
  onTogglePropertiesPanel: vi.fn(),
});

describe("DatabaseToolbar", () => {
  it("renders action buttons and search in separate right-aligned wrappers", () => {
    const props = buildProps();
    const { container, cleanup } = render(
      createElement(DatabaseToolbar, props),
    );

    const actions = container.querySelector(".database-block-toolbar-actions");
    const actionButtons = container.querySelector(".database-block-toolbar-action-buttons");
    const searchWrap = container.querySelector(".database-block-toolbar-search-wrap");
    const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Sortieren"),
    );
    const filterButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Filtern"),
    );
    const propertiesButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Eigenschaften"),
    );

    expect(actions).toBeTruthy();
    expect(actionButtons).toBeTruthy();
    expect(searchWrap?.querySelector(".database-block-search")).toBeTruthy();
    expect(sortButton).toBeTruthy();
    expect(filterButton).toBeTruthy();
    expect(propertiesButton).toBeTruthy();

    cleanup();
  });

  it("forwards interaction events", () => {
    const props = buildProps();
    const { container, cleanup } = render(
      createElement(DatabaseToolbar, props),
    );

    const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Sortieren"),
    );
    const sourceButton = container.querySelector(".database-block-source-button");
    const search = container.querySelector<HTMLInputElement>(".database-block-search");
    const viewSelect = container.querySelector<HTMLSelectElement>(".database-block-view-select");
    const titleInput = container.querySelector<HTMLInputElement>(".database-block-title-input");

    act(() => {
      if (search) {
        search.value = "IUFS";
      }
      if (viewSelect) {
        viewSelect.value = "kanban";
      }
      if (titleInput) {
        titleInput.value = "Neue DB";
      }
      sortButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      sourceButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      search?.dispatchEvent(new Event("input", { bubbles: true }));
      viewSelect?.dispatchEvent(new Event("change", { bubbles: true }));
      titleInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(props.onToggleSortPanel).toHaveBeenCalledTimes(1);
    expect(props.onToggleSourcePanel).toHaveBeenCalledTimes(1);
    expect(props.onSearchChange).toHaveBeenCalled();
    expect(props.onViewTypeChange).toHaveBeenCalled();
    expect(props.onTitleChange).toHaveBeenCalled();

    cleanup();
  });
});
