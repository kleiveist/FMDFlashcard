/**
 * @file apps/fmd-desktop/src/lib/userVaultUsers.test.ts
 *
 * Zweck:
 * - Tests fuer deterministische User-Resolution pro Source.
 */

import { describe, expect, it } from "vitest";
import { resolveActiveUser, type UserVaultCandidate } from "./userVaultUsers";

const autoUsers: UserVaultCandidate[] = [
  { id: "auto-1", name: "Auto A", path: "/vault/user-a", source: "auto" },
];
const customUsers: UserVaultCandidate[] = [
  { id: "custom-1", name: "Custom A", path: "/custom/user-a", source: "custom" },
  { id: "custom-2", name: "Custom B", path: "/custom/user-b", source: "custom" },
];

describe("resolveActiveUser", () => {
  it("keeps custom source even when auto users exist", () => {
    const result = resolveActiveUser({
      source: "custom",
      autoUsers,
      customUsers,
      selectedAutoPath: "/vault/user-a",
      selectedCustomPath: "/custom/user-b",
      autoError: null,
      customError: null,
    });
    expect(result.activeUser?.path).toBe("/custom/user-b");
  });

  it("keeps auto source even when custom users exist", () => {
    const result = resolveActiveUser({
      source: "auto",
      autoUsers,
      customUsers,
      selectedAutoPath: "/vault/user-a",
      selectedCustomPath: "/custom/user-b",
      autoError: null,
      customError: null,
    });
    expect(result.activeUser?.path).toBe("/vault/user-a");
  });

  it("falls back to first user when selection is missing", () => {
    const result = resolveActiveUser({
      source: "custom",
      autoUsers,
      customUsers,
      selectedAutoPath: null,
      selectedCustomPath: null,
      autoError: null,
      customError: null,
    });
    expect(result.activeUser?.path).toBe("/custom/user-a");
    expect(result.reason).toBe("fallback");
  });
});
