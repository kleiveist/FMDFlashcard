// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/components/SidebarNav.test.tsx
 *
 * Zweck:
 * - Tests fuer Active-User-Switcher in der Sidebar.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarNav } from "./SidebarNav";
import { useAppState } from "./AppStateProvider";
import { useVaultPathInfo } from "../features/vault/useVaultPathInfo";

vi.mock("./AppStateProvider", () => ({
  useAppState: vi.fn(),
}));

vi.mock("../features/vault/useVaultPathInfo", () => ({
  useVaultPathInfo: vi.fn(() => ({})),
}));

type MockUser = { id: string; name: string };

type RenderOptions = {
  users?: MockUser[];
  activeUserId?: string | null;
  activeUserName?: string | null;
  setActiveUser?: (userId: string) => void;
};

const mockUseAppState = vi.mocked(useAppState);
const mockUseVaultPathInfo = vi.mocked(useVaultPathInfo);

const defaultUsers: MockUser[] = [
  { id: "alice", name: "Alice Doe" },
  { id: "bob", name: "Bob Smith" },
];

const createMockAppState = ({
  users = defaultUsers,
  activeUserId = "alice",
  activeUserName = "Alice Doe",
  setActiveUser = vi.fn(),
}: RenderOptions = {}) =>
  ({
    actions: {
      handleOpenVaultManager: vi.fn(),
      handleRemoveRecentVault: vi.fn(),
      handleRescanVault: vi.fn(async () => false),
      handleSelectFile: vi.fn(),
      handleSwitchVault: vi.fn(async () => false),
    },
    preview: {
      resetPreview: vi.fn(),
      selectedFile: null,
    },
    settings: {
      recentVaults: [],
      showEmptyFolders: false,
      showHiddenFolders: false,
    },
    spacedRepetition: {
      setActiveUser,
      spacedRepetitionActiveUser: activeUserName,
      spacedRepetitionActiveUserId: activeUserId,
      spacedRepetitionUsers: users,
    },
    vault: {
      activeFolderPath: null,
      files: [],
      folders: [],
      lastRefreshAt: null,
      listError: "",
      listState: "idle",
      setActiveFolderPath: vi.fn(),
      vaultPath: null,
    },
  }) as unknown as ReturnType<typeof useAppState>;

const renderSidebar = (options: RenderOptions = {}) => {
  const onOpenUserManager = vi.fn();
  mockUseAppState.mockReturnValue(createMockAppState(options));
  mockUseVaultPathInfo.mockReturnValue({});

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <SidebarNav
        activeTab="exam"
        onTabChange={vi.fn()}
        vaultView="markdown"
        onVaultViewChange={vi.fn()}
        onOpenHelp={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenUserManager={onOpenUserManager}
        onMobileNavClose={vi.fn()}
      />,
    );
  });

  return {
    container,
    onOpenUserManager,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const openUserMenu = (container: HTMLElement) => {
  const trigger = container.querySelector<HTMLButtonElement>(".sidebar-active-user-trigger");
  act(() => {
    trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

describe("SidebarNav active user switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the active user and fallback when none is active", () => {
    const first = renderSidebar({
      activeUserId: "alice",
      activeUserName: "Alice Doe",
    });
    expect(first.container.textContent).toContain("Alice Doe");
    first.cleanup();

    const second = renderSidebar({
      activeUserId: null,
      activeUserName: null,
    });
    expect(second.container.textContent).toContain("No active user");
    second.cleanup();
  });

  it("opens dropdown with all users and marks the active user", () => {
    const { container, cleanup } = renderSidebar();
    openUserMenu(container);

    const menu = container.querySelector("#sidebar-active-user-menu");
    expect(menu).toBeTruthy();
    expect(menu?.textContent).toContain("Alice Doe");
    expect(menu?.textContent).toContain("Bob Smith");

    const activeItem = menu?.querySelector(
      '[role="menuitemradio"][aria-checked="true"]',
    );
    expect(activeItem?.textContent).toContain("Alice Doe");
    cleanup();
  });

  it("switches active user, closes on outside click and closes on Escape", () => {
    const setActiveUser = vi.fn();
    const { container, cleanup } = renderSidebar({ setActiveUser });

    openUserMenu(container);
    const userButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '#sidebar-active-user-menu [role="menuitemradio"]',
      ),
    );
    const bobButton = userButtons.find((button) =>
      button.textContent?.includes("Bob Smith"),
    );
    act(() => {
      bobButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(setActiveUser).toHaveBeenCalledWith("bob");
    expect(container.querySelector("#sidebar-active-user-menu")).toBeNull();

    openUserMenu(container);
    expect(container.querySelector("#sidebar-active-user-menu")).toBeTruthy();
    act(() => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(container.querySelector("#sidebar-active-user-menu")).toBeNull();

    openUserMenu(container);
    const menu = container.querySelector("#sidebar-active-user-menu");
    act(() => {
      menu?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector("#sidebar-active-user-menu")).toBeNull();
    cleanup();
  });

  it("calls onOpenUserManager from Manage User action", () => {
    const { container, onOpenUserManager, cleanup } = renderSidebar();
    openUserMenu(container);

    const manageButton = container.querySelector<HTMLButtonElement>(
      ".sidebar-active-user-menu-manage",
    );
    act(() => {
      manageButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenUserManager).toHaveBeenCalledTimes(1);
    expect(container.querySelector("#sidebar-active-user-menu")).toBeNull();
    cleanup();
  });
});
