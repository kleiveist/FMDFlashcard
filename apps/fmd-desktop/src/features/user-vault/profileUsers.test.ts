/**
 * @file apps/fmd-desktop/src/features/user-vault/profileUsers.test.ts
 *
 * Zweck:
 * - Tests fuer das Laden von Usern innerhalb des Profile-Roots.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listUserVaultProfiles, migrateDefaultProfileFolders } from "./storage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
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
    if (command === "write_json_file") {
      const { path: filePath, contents } = args as { path: string; contents: string };
      files.set(normalize(filePath), contents);
      return null;
    }
    if (command === "get_path_info") {
      const exists = directories.has(path);
      return { exists, isDir: exists };
    }
    if (command === "rename_directory") {
      const { from, to } = args as { from: string; to: string };
      const normalizedFrom = normalize(from);
      const normalizedTo = normalize(to);
      if (!directories.has(normalizedFrom)) {
        throw new Error("Folder not found.");
      }
      directories.delete(normalizedFrom);
      directories.set(normalizedTo, []);
      Array.from(directories.keys()).forEach((entry) => {
        if (entry.startsWith(`${normalizedFrom}/`)) {
          const next = normalizedTo + entry.slice(normalizedFrom.length);
          const children = directories.get(entry) ?? [];
          directories.delete(entry);
          directories.set(next, children);
        }
      });
      Array.from(files.keys()).forEach((filePath) => {
        if (filePath.startsWith(`${normalizedFrom}/`)) {
          const next = normalizedTo + filePath.slice(normalizedFrom.length);
          const contents = files.get(filePath) ?? "";
          files.delete(filePath);
          files.set(next, contents);
        }
      });
      return null;
    }
    if (command === "get_os_username") {
      return "kleif";
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

describe("migrateDefaultProfileFolders", () => {
  it("renames default profile folders to username-based ids", async () => {
    addDir("/profile-root", ["users"]);
    addDir("/profile-root/users", ["2026-02-11_default-1"]);
    addDir("/profile-root/users/2026-02-11_default-1");
    files.set(
      "/profile-root/users/2026-02-11_default-1/profile.json",
      JSON.stringify({
        id: "2026-02-11_default-1",
        name: "Kleif",
        createdAt: "2026-02-11T00:00:00.000Z",
      }),
    );
    files.set(
      "/profile-root/user-vault.json",
      JSON.stringify({ schemaVersion: 1, activeProfileId: "2026-02-11_default-1" }),
    );

    await migrateDefaultProfileFolders("/profile-root");

    expect(directories.has("/profile-root/users/2026-02-11_kleif")).toBe(true);
    const updated = JSON.parse(
      files.get("/profile-root/users/2026-02-11_kleif/profile.json") ?? "{}",
    );
    expect(updated.id).toBe("2026-02-11_kleif");
    expect(updated.name).toBe("kleif");
    const meta = JSON.parse(files.get("/profile-root/user-vault.json") ?? "{}");
    expect(meta.activeProfileId).toBe("2026-02-11_kleif");
  });
});
