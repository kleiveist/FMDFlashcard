/**
 * @file apps/fmd-desktop/src/features/user-vault/userScan.test.ts
 *
 * Zweck:
 * - Tests fuer das Scannen von User-Ordnern im Custom-Root.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { scanUsersInRoot } from "./storage";

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

const addUserVault = (path: string) => {
  const normalized = normalize(path);
  files.set(`${normalized}/user-vault.json`, "{}");
};

beforeEach(() => {
  directories.clear();
  files.clear();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command, args) => {
    const path = normalize(String((args as { path?: string })?.path ?? ""));
    if (command === "get_path_info") {
      const exists = directories.has(path);
      return { exists, isDir: exists };
    }
    if (command === "list_directories") {
      if (!directories.has(path)) {
        throw new Error("Path does not exist.");
      }
      return directories.get(path) ?? [];
    }
    if (command === "read_json_file") {
      if (!files.has(path)) {
        throw new Error("File not found.");
      }
      return files.get(path) ?? "{}";
    }
    throw new Error(`Unknown command: ${String(command)}`);
  });
});

describe("scanUsersInRoot", () => {
  it("finds users inside the users/ subfolder", async () => {
    addDir("/custom", ["users"]);
    addDir("/custom/users", ["alpha"]);
    addUserVault("/custom/users/alpha");

    const result = await scanUsersInRoot("/custom", "custom");

    expect(result.error).toBeNull();
    expect(result.users.map((user) => user.path)).toEqual([
      "/custom/users/alpha",
    ]);
  });

  it("finds users directly under the root", async () => {
    addDir("/custom", ["beta"]);
    addUserVault("/custom/beta");

    const result = await scanUsersInRoot("/custom", "custom");

    expect(result.error).toBeNull();
    expect(result.users.map((user) => user.path)).toEqual(["/custom/beta"]);
  });

  it("returns a deterministic order when both root and users/ exist", async () => {
    addDir("/custom", ["alpha", "users"]);
    addDir("/custom/users", ["beta"]);
    addUserVault("/custom");
    addUserVault("/custom/alpha");
    addUserVault("/custom/users/beta");

    const result = await scanUsersInRoot("/custom", "custom");

    expect(result.error).toBeNull();
    expect(result.users.map((user) => user.path)).toEqual([
      "/custom",
      "/custom/alpha",
      "/custom/users/beta",
    ]);
  });
});
