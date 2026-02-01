/**
 * @file apps/fmd-desktop/src/lib/userVaultUsers.ts
 *
 * Zweck:
 * - Deterministische Aufloesung des aktiven User-Ordners je Source (Auto/Custom).
 */

import type { UserVaultMode } from "./userVault";

export type UserVaultCandidate = {
  id: string;
  name: string;
  path: string;
  source: UserVaultMode;
};

export type ResolveActiveUserInput = {
  source: UserVaultMode;
  autoUsers: UserVaultCandidate[];
  customUsers: UserVaultCandidate[];
  selectedAutoPath: string | null;
  selectedCustomPath: string | null;
  autoError: string | null;
  customError: string | null;
};

export type ResolveActiveUserResult = {
  activeUser: UserVaultCandidate | null;
  reason: "selected" | "fallback" | "error";
  error: string;
};

export const sortUserVaultCandidates = (candidates: UserVaultCandidate[]) =>
  [...candidates].sort((a, b) => {
    const idCompare = a.id.localeCompare(b.id, undefined, {
      sensitivity: "base",
    });
    if (idCompare !== 0) {
      return idCompare;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

export const resolveActiveUser = ({
  source,
  autoUsers,
  customUsers,
  selectedAutoPath,
  selectedCustomPath,
  autoError,
  customError,
}: ResolveActiveUserInput): ResolveActiveUserResult => {
  const users = source === "custom" ? customUsers : autoUsers;
  const selectedPath = source === "custom" ? selectedCustomPath : selectedAutoPath;
  const sourceError = source === "custom" ? customError : autoError;
  if (sourceError) {
    return { activeUser: null, reason: "error", error: sourceError };
  }
  if (users.length === 0) {
    const error =
      source === "custom"
        ? "No users found in the custom path."
        : "No users found in the vault user path.";
    return { activeUser: null, reason: "error", error };
  }
  const selected =
    selectedPath ? users.find((user) => user.path === selectedPath) ?? null : null;
  const activeUser = selected ?? users[0] ?? null;
  return {
    activeUser,
    reason: selected ? "selected" : "fallback",
    error: "",
  };
};
