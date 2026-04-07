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
  activeViewId: "view-table",
  activeViewName: "Default View",
  savedViews: [
    { id: "view-table", name: "Default View" },
    { id: "view-kanban", name: "Kanban Fokus" },
  ],
  sourceLabel: "Quelle",
  viewType: "table" as const,
  kanbanGroupBy: null,
  kanbanGroupByOptions: [
    { key: "status", label: "Status" },
  ],
  searchQuery: "",
  showSearch: true,
  onSearchChange: vi.fn(),
  onViewTypeChange: vi.fn(),
  onKanbanGroupByChange: vi.fn(),
  onSelectSavedView: vi.fn(),
  onCreateSavedView: vi.fn(),
  isSourcePanelOpen: false,
  isFilterPanelOpen: false,
  isSortPanelOpen: false,
  isPropertiesPanelOpen: false,
  isGanttPanelOpen: false,
  isProjectPanelOpen: false,
  isPiePanelOpen: false,
  onToggleSourcePanel: vi.fn(),
  onToggleFilterPanel: vi.fn(),
  onToggleSortPanel: vi.fn(),
  onTogglePropertiesPanel: vi.fn(),
  onToggleGanttPanel: vi.fn(),
  onToggleProjectPanel: vi.fn(),
  onTogglePiePanel: vi.fn(),
});

describe("DatabaseToolbar", () => {
  it("renders unified main row with icon-only action buttons", () => {
    const props = buildProps();
    const { container, cleanup } = render(createElement(DatabaseToolbar, props));

    const mainRow = container.querySelector(".database-block-toolbar-row-main");
    const viewButton = container.querySelector<HTMLButtonElement>(".database-block-view-name-button");
    const sourceButton = container.querySelector<HTMLButtonElement>(".database-block-source-button");
    const sortButton = container.querySelector<HTMLButtonElement>("button[aria-label='Sortieren']");
    const filterButton = container.querySelector<HTMLButtonElement>("button[aria-label='Filtern']");
    const propertiesButton = container.querySelector<HTMLButtonElement>("button[aria-label='Eigenschaften']");
    const searchButton = container.querySelector<HTMLButtonElement>("button[aria-label='Suche']");

    expect(mainRow).toBeTruthy();
    expect(viewButton?.textContent).toContain("Default View");
    expect(sourceButton?.textContent).toBe("Quelle");
    expect(sortButton?.classList.contains("database-block-toolbar-button-icon-only")).toBe(true);
    expect(filterButton?.classList.contains("database-block-toolbar-button-icon-only")).toBe(true);
    expect(propertiesButton?.classList.contains("database-block-toolbar-button-icon-only")).toBe(true);
    expect(searchButton?.classList.contains("database-block-toolbar-button-icon-only")).toBe(true);
    expect(container.querySelector(".database-block-toolbar-search-input")).toBeNull();

    cleanup();
  });

  it("forwards main-row interactions", () => {
    const props = buildProps();
    const { container, cleanup } = render(createElement(DatabaseToolbar, props));

    const sourceButton = container.querySelector<HTMLButtonElement>(".database-block-source-button");
    const sortButton = container.querySelector<HTMLButtonElement>("button[aria-label='Sortieren']");
    const filterButton = container.querySelector<HTMLButtonElement>("button[aria-label='Filtern']");
    const propertiesButton = container.querySelector<HTMLButtonElement>("button[aria-label='Eigenschaften']");
    const viewSelect = container.querySelector<HTMLSelectElement>(".database-block-view-select");

    act(() => {
      sourceButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      sortButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      filterButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      propertiesButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      if (viewSelect) {
        viewSelect.value = "kanban";
        viewSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(props.onToggleSourcePanel).toHaveBeenCalledTimes(1);
    expect(props.onToggleSortPanel).toHaveBeenCalledTimes(1);
    expect(props.onToggleFilterPanel).toHaveBeenCalledTimes(1);
    expect(props.onTogglePropertiesPanel).toHaveBeenCalledTimes(1);
    expect(props.onViewTypeChange).toHaveBeenCalledWith("kanban");

    cleanup();
  });

  it("opens search dropdown and forwards search input changes", () => {
    const props = buildProps();
    const { container, cleanup } = render(createElement(DatabaseToolbar, props));

    const searchButton = container.querySelector<HTMLButtonElement>("button[aria-label='Suche']");

    act(() => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const searchInput = container.querySelector<HTMLInputElement>(".database-block-toolbar-search-input");
    expect(searchInput).toBeTruthy();

    act(() => {
      if (searchInput) {
        searchInput.value = "IUFS";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    expect(props.onSearchChange).toHaveBeenCalledWith("IUFS");

    cleanup();
  });

  it("supports selecting and creating saved views from the dropdown", () => {
    const props = buildProps();
    const { container, cleanup } = render(createElement(DatabaseToolbar, props));

    const viewButton = container.querySelector<HTMLButtonElement>(".database-block-view-name-button");

    act(() => {
      viewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const activeItem = container.querySelector(".database-block-view-dropdown-item.is-active");
    const secondItem = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"))
      .find((button) => button.textContent?.includes("Kanban Fokus"));

    expect(activeItem?.textContent).toContain("Default View");

    act(() => {
      secondItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onSelectSavedView).toHaveBeenCalledWith("view-kanban");

    act(() => {
      viewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const createInput = container.querySelector<HTMLInputElement>(".database-block-toolbar-create-view-input");
    const createButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Create View"));

    act(() => {
      if (createInput) {
        createInput.value = "Neue View";
        createInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onCreateSavedView).toHaveBeenCalledWith("Neue View");

    cleanup();
  });

  it("renders view-specific controls in the fixed second row", () => {
    const baseProps = buildProps();

    const kanban = render(createElement(DatabaseToolbar, {
      ...baseProps,
      viewType: "kanban",
      kanbanGroupBy: "status",
    }));
    const secondaryKanban = kanban.container.querySelector(".database-block-toolbar-row-secondary");
    const groupSelect = secondaryKanban?.querySelector<HTMLSelectElement>(".database-block-view-select");
    expect(secondaryKanban).toBeTruthy();
    expect(groupSelect).toBeTruthy();
    act(() => {
      if (groupSelect) {
        groupSelect.value = "";
        groupSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(baseProps.onKanbanGroupByChange).toHaveBeenCalledWith(null);
    kanban.cleanup();

    const ganttProps = buildProps();
    const gantt = render(createElement(DatabaseToolbar, {
      ...ganttProps,
      viewType: "gantt",
    }));
    const timelineButton = Array.from(gantt.container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Timeline Optionen"));
    expect(timelineButton).toBeTruthy();
    act(() => {
      timelineButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(ganttProps.onToggleGanttPanel).toHaveBeenCalledTimes(1);
    gantt.cleanup();

    const projectProps = buildProps();
    const project = render(createElement(DatabaseToolbar, {
      ...projectProps,
      viewType: "project",
    }));
    const projectButton = Array.from(project.container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Project Optionen"));
    expect(projectButton).toBeTruthy();
    act(() => {
      projectButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(projectProps.onToggleProjectPanel).toHaveBeenCalledTimes(1);
    project.cleanup();

    const pieProps = buildProps();
    const pie = render(createElement(DatabaseToolbar, {
      ...pieProps,
      viewType: "pie",
    }));
    const pieButton = Array.from(pie.container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Pie Optionen"));
    expect(pieButton).toBeTruthy();
    act(() => {
      pieButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(pieProps.onTogglePiePanel).toHaveBeenCalledTimes(1);
    pie.cleanup();
  });
});
