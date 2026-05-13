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
  searchQuery: "",
  showSearch: true,
  onSearchChange: vi.fn(),
  onViewTypeChange: vi.fn(),
  onSelectSavedView: vi.fn(),
  onCreateSavedView: vi.fn(),
  onRenameSavedView: vi.fn(),
  onDeleteSavedView: vi.fn(),
  onDuplicateSavedView: vi.fn(),
  onReorderSavedViews: vi.fn(),
  onMoveSavedView: vi.fn(),
  isSourcePanelOpen: false,
  isFilterPanelOpen: false,
  isSortPanelOpen: false,
  isPropertiesPanelOpen: false,
  isKanbanPanelOpen: false,
  isGanttPanelOpen: false,
  isProjectPanelOpen: false,
  isPiePanelOpen: false,
  hasAnyPanelOpen: false,
  onToggleSourcePanel: vi.fn(),
  onToggleFilterPanel: vi.fn(),
  onToggleSortPanel: vi.fn(),
  onTogglePropertiesPanel: vi.fn(),
  onToggleKanbanPanel: vi.fn(),
  onToggleGanttPanel: vi.fn(),
  onToggleProjectPanel: vi.fn(),
  onTogglePiePanel: vi.fn(),
  onCloseAllPanels: vi.fn(),
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

  it("closes open panels before opening search to avoid overlay", () => {
    const props = {
      ...buildProps(),
      hasAnyPanelOpen: true,
    };
    const { container, cleanup } = render(createElement(DatabaseToolbar, props));

    const searchButton = container.querySelector<HTMLButtonElement>("button[aria-label='Suche']");

    act(() => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onCloseAllPanels).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".database-block-toolbar-search-input")).toBeNull();

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

  it("supports context-menu rename/delete/duplicate/move actions for saved views", () => {
    const props = buildProps();
    const confirmSpy = vi.spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { container, cleanup } = render(createElement(DatabaseToolbar, props));

    const viewButton = container.querySelector<HTMLButtonElement>(".database-block-view-name-button");
    act(() => {
      viewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const targetItem = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"))
      .find((button) => button.textContent?.includes("Kanban Fokus"));
    expect(targetItem).toBeTruthy();

    const targetRow = targetItem?.closest(".database-block-view-dropdown-row");
    const menuTrigger = targetRow?.querySelector<HTMLButtonElement>(".database-block-view-dropdown-menu-trigger");
    act(() => {
      menuTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const renameButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".database-block-view-context-menu-item"))
      .find((button) => button.textContent?.includes("Rename"));
    act(() => {
      renameButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const renameInput = container.querySelector<HTMLInputElement>(".database-block-view-dropdown-rename-input");
    expect(renameInput).toBeTruthy();
    act(() => {
      if (renameInput) {
        renameInput.value = "Kanban Fokus 2";
        renameInput.dispatchEvent(new Event("input", { bubbles: true }));
        renameInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
      }
    });
    expect(props.onRenameSavedView).toHaveBeenCalledWith("view-kanban", "Kanban Fokus 2");

    const renamedTargetItem = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"))
      .find((button) => button.textContent?.includes("Kanban Fokus"));
    act(() => {
      renamedTargetItem?.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 125,
        clientY: 145,
      }));
    });
    const duplicateButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".database-block-view-context-menu-item"))
      .find((button) => button.textContent?.includes("Duplicate"));
    act(() => {
      duplicateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(props.onDuplicateSavedView).toHaveBeenCalledWith("view-kanban");

    const duplicateTargetItem = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"))
      .find((button) => button.textContent?.includes("Kanban Fokus"));
    act(() => {
      duplicateTargetItem?.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 130,
        clientY: 150,
      }));
    });
    const moveUpButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".database-block-view-context-menu-item"))
      .find((button) => button.textContent?.includes("Move up"));
    act(() => {
      moveUpButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(props.onMoveSavedView).toHaveBeenCalledWith("view-kanban", "up");

    const deleteTargetItem = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"))
      .find((button) => button.textContent?.includes("Kanban Fokus"));
    act(() => {
      deleteTargetItem?.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 135,
        clientY: 155,
      }));
    });
    const deleteButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".database-block-view-context-menu-item"))
      .find((button) => button.textContent?.includes("Delete"));
    act(() => {
      deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(props.onDeleteSavedView).not.toHaveBeenCalled();

    const deleteConfirmTargetItem = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"))
      .find((button) => button.textContent?.includes("Kanban Fokus"));
    act(() => {
      deleteConfirmTargetItem?.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 140,
        clientY: 160,
      }));
    });
    const deleteButtonConfirm = Array.from(document.querySelectorAll<HTMLButtonElement>(".database-block-view-context-menu-item"))
      .find((button) => button.textContent?.includes("Delete"));
    act(() => {
      deleteButtonConfirm?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(props.onDeleteSavedView).toHaveBeenCalledWith("view-kanban");
    expect(confirmSpy).toHaveBeenCalledTimes(2);

    confirmSpy.mockRestore();
    cleanup();
  });

  it("supports drag-and-drop reordering of saved views", () => {
    const props = buildProps();
    const { container, cleanup } = render(createElement(DatabaseToolbar, props));

    const viewButton = container.querySelector<HTMLButtonElement>(".database-block-view-name-button");
    act(() => {
      viewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const items = Array.from(container.querySelectorAll<HTMLButtonElement>(".database-block-view-dropdown-item"));
    const firstItem = items[0];
    const secondItem = items[1];
    expect(firstItem).toBeTruthy();
    expect(secondItem).toBeTruthy();

    act(() => {
      secondItem?.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }));
      firstItem?.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
      firstItem?.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
      secondItem?.dispatchEvent(new Event("dragend", { bubbles: true }));
    });

    expect(props.onReorderSavedViews).toHaveBeenCalledWith("view-kanban", "view-table");

    cleanup();
  });

  it("renders view-specific controls in the fixed second row", () => {
    const baseProps = buildProps();

    const kanban = render(createElement(DatabaseToolbar, {
      ...baseProps,
      viewType: "kanban",
    }));
    const secondaryKanban = kanban.container.querySelector(".database-block-toolbar-row-secondary");
    const kanbanButton = Array.from(kanban.container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Kanban Optionen"));
    expect(secondaryKanban).toBeTruthy();
    expect(kanbanButton).toBeTruthy();
    expect(secondaryKanban?.querySelector(".database-block-view-select-secondary")).toBeNull();
    act(() => {
      kanbanButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(baseProps.onToggleKanbanPanel).toHaveBeenCalledTimes(1);
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
