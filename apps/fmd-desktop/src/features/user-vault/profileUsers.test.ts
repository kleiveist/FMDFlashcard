/**
 * @file apps/fmd-desktop/src/features/user-vault/profileUsers.test.ts
 *
 * Zweck:
 * - Tests fuer das Laden von Usern innerhalb des Profile-Roots.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listUserVaultProfiles } from "./storage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const directories = new Map<string, string[]>();
const files = new Map<string, string>();

const normalize = (path: string) => path.replace(/\\/g, "/");

const addDir = (path: string, entries: string[] = []) => {
  directories.set(normalize(path), entries);
};

const addUserProfile = (path: string) => {
  const normalized = normalize(path);
  files.set(`${normalized}/profile.json`, "{}");
};

beforeEach(() => {
  directories.clear();
  files.clear();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command, args) => {
    const path = normalize(String((args as { path?: string })?.path ?? ""));
    if (command === "list_directories") {
      return directories.get(path) ?? [];
    }
    if (command === "read_json_file") {
      if (!files.has(path)) {
        throw new Error("File not found.");
      }
      return files.get(path) ?? "{}";
    }
    if (command === "get_path_info") {
      const exists = directories.has(path);
      return { exists, isDir: exists };
    }
    throw new Error(`Unknown command: ${String(command)}`);
  });
});

describe("listUserVaultProfiles", () => {
  it("finds users inside the users/ subfolder", async () => {
    addDir("/profile-root", ["users"]);
    addDir("/profile-root/users", ["alpha"]);
    addUserProfile("/profile-root/users/alpha");

    const result = await listUserVaultProfiles("/profile-root");

    expect(result.map((entry) => entry.path)).toEqual([
      "/profile-root/users/alpha",
    ]);
  });

  it("falls back to legacy profiles/ entries", async () => {
    addDir("/profile-root", ["profiles"]);
    addDir("/profile-root/profiles", ["beta"]);
    addUserProfile("/profile-root/profiles/beta");

    const result = await listUserVaultProfiles("/profile-root");

    expect(result.map((entry) => entry.path)).toEqual([
      "/profile-root/profiles/beta",
    ]);
  });

  it("includes user entries directly under the root when they contain profile.json", async () => {
    addDir("/profile-root", ["gamma"]);
    addUserProfile("/profile-root/gamma");

    const result = await listUserVaultProfiles("/profile-root");

    expect(result.map((entry) => entry.path)).toEqual(["/profile-root/gamma"]);
  });
});
