/**
 * @file apps/fmd-desktop/src/lib/userVault.ts
 *
 * Zweck:
 * - Hilfsfunktionen und Typen fuer User Vault.
 */

import type { SpacedRepetitionStorage } from "../features/spaced-repetition/logic";
import type { FastFlashcardSessionSummary } from "./fastFlashcard";
import type { ExamRun } from "./examRuns";
import { joinPath } from "./path";

export type UserVaultMode = "auto" | "custom";
export type UserVaultImportStrategy = "merge" | "overwrite";

export type UserVaultProfileMeta = {
  id: string;
  name: string;
  createdAt: string;
};

export type UserVaultProfileSettings = Record<string, unknown>;

export type UserVaultProfileData = {
  spacedRepetitionByVaultId: Record<string, SpacedRepetitionStorage>;
  fastFlashcardSessions: FastFlashcardSessionSummary[];
  examRuns: ExamRun[];
  settings?: UserVaultProfileSettings | null;
};

export type UserVaultProfileExportEntry = {
  profile: UserVaultProfileMeta;
  data: UserVaultProfileData;
};

export type UserVaultExportPayload =
  | {
      schemaVersion: number;
      exportedAt: string;
      profile: UserVaultProfileMeta;
      data: UserVaultProfileData;
    }
  | {
      schemaVersion: number;
      exportedAt: string;
      profiles: UserVaultProfileExportEntry[];
    };

export const USER_VAULT_SCHEMA_VERSION = 1;
export const PROFILE_ROOT_DIR = "profile";
export const LEGACY_PROFILE_ROOT_DIR = "user";

const INVALID_PROFILE_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
const PROFILE_ID_PATTERN = /^(\d{4}-\d{2}-\d{2})_(.+)$/;
const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const sanitizeProfileName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed
    .replace(/\s+/g, "-")
    .replace(INVALID_PROFILE_CHARS, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized;
};

export const formatDateStamp = (date: Date) => localDateFormatter.format(date);

export const buildProfileId = (name: string, date: Date = new Date()) => {
  const sanitized = sanitizeProfileName(name);
  if (!sanitized) {
    return null;
  }
  return `${formatDateStamp(date)}_${sanitized}`;
};

export const parseProfileId = (value: string) => {
  const match = value.match(PROFILE_ID_PATTERN);
  if (!match) {
    return { dateStamp: "", name: value };
  }
  return { dateStamp: match[1] ?? "", name: match[2] ?? value };
};

export const resolveActiveProfileRoot = (
  mode: UserVaultMode,
  vaultPath: string | null,
  customPath: string | null,
): string | null => {
  if (mode === "custom") {
    const trimmed = customPath?.trim() ?? "";
    return trimmed ? trimmed : null;
  }
  if (mode === "auto") {
    return vaultPath ? joinPath(vaultPath, PROFILE_ROOT_DIR) : null;
  }
  return null;
};

export const resolveUserVaultPath = resolveActiveProfileRoot;

export const createEmptyProfileData = (): UserVaultProfileData => ({
  spacedRepetitionByVaultId: {},
  fastFlashcardSessions: [],
  examRuns: [],
  settings: null,
});

const mergeById = <T,>(
  base: T[],
  incoming: T[],
  getId: (value: T) => string,
) => {
  const merged = [...base];
  const seen = new Set(base.map(getId));
  incoming.forEach((entry) => {
    const id = getId(entry);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    merged.push(entry);
  });
  return merged;
};

export const mergeSpacedRepetitionStorage = (
  base: SpacedRepetitionStorage,
  incoming: SpacedRepetitionStorage,
): SpacedRepetitionStorage => {
  const users = [...base.users];
  const userIds = new Set(base.users.map((user) => user.id));
  incoming.users.forEach((user) => {
    if (!userIds.has(user.id)) {
      users.push(user);
      userIds.add(user.id);
    }
  });
  return {
    users,
    userStateById: {
      ...incoming.userStateById,
      ...base.userStateById,
    },
    lastActiveUserId: base.lastActiveUserId ?? incoming.lastActiveUserId ?? null,
  };
};

export const mergeProfileData = (
  base: UserVaultProfileData,
  incoming: UserVaultProfileData,
  strategy: UserVaultImportStrategy,
): UserVaultProfileData => {
  const incomingHasSettings = Object.prototype.hasOwnProperty.call(
    incoming,
    "settings",
  );
  if (strategy === "overwrite") {
    return {
      ...incoming,
      settings: incomingHasSettings ? incoming.settings ?? null : base.settings ?? null,
    };
  }
  const spacedRepetitionByVaultId = { ...base.spacedRepetitionByVaultId };
  Object.entries(incoming.spacedRepetitionByVaultId).forEach(
    ([vaultId, storage]) => {
      if (!spacedRepetitionByVaultId[vaultId]) {
        spacedRepetitionByVaultId[vaultId] = storage;
      } else {
        spacedRepetitionByVaultId[vaultId] = mergeSpacedRepetitionStorage(
          spacedRepetitionByVaultId[vaultId],
          storage,
        );
      }
    },
  );
  return {
    spacedRepetitionByVaultId,
    fastFlashcardSessions: mergeById(
      base.fastFlashcardSessions,
      incoming.fastFlashcardSessions,
      (session) => session.id,
    ),
    examRuns: mergeById(base.examRuns, incoming.examRuns, (run) => run.id),
    settings: base.settings ?? incoming.settings ?? null,
  };
};

export const selectProfileFromExport = (
  payload: UserVaultExportPayload,
  preferredProfileId: string | null,
): UserVaultProfileExportEntry | null => {
  if ("profile" in payload) {
    return {
      profile: payload.profile,
      data: payload.data,
    };
  }
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  if (preferredProfileId) {
    const match = profiles.find(
      (entry) => entry.profile.id === preferredProfileId,
    );
    if (match) {
      return match;
    }
  }
  return profiles[0] ?? null;
};

export const buildUserVaultProfilePath = (
  userVaultPath: string,
  profileId: string,
) => joinPath(userVaultPath, "profiles", profileId);
