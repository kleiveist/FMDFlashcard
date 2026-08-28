/**
 * @file apps/fmd-desktop/src/features/user-vault/storage.ts
 *
 * Zweck:
 * - Dateizugriff fuer den User Vault.
 */

import { invoke } from "@tauri-apps/api/core";
import { asErrorMessage } from "../../lib/errors";
import { joinPath } from "../../lib/path";
import { parseFrontmatterDocument } from "../preview/frontmatter";
import {
  LEGACY_PROFILE_ROOT_DIR,
  PROFILE_ROOT_DIR,
  USER_VAULT_SCHEMA_VERSION,
  buildProfileId,
  parseProfileId,
  sanitizeProfileName,
  type UserVaultProfileData,
  type UserVaultProfileMeta,
  type UserVaultProfileSettings,
} from "../../lib/userVault";
import type { FastFlashcardSessionSummary } from "../../lib/fastFlashcard";
import { resolveExamStatusDescriptor, type ExamRun } from "../../lib/examRuns";
import {
  EXAM_POINTS_PROFILE_SCHEMA_VERSION,
  createEmptyExamPointsProfilesStore,
  normalizeExamPointsProfilesStore,
  type ExamPointsProfilesStore,
} from "../../lib/exam/pointsProfiles";
import {
  normalizeSpacedRepetitionCardProgress,
  type SpacedRepetitionCardProgress,
  type SpacedRepetitionStorage,
  type SpacedRepetitionUser,
  type SpacedRepetitionUserState,
} from "../spaced-repetition/logic";

type PathInfo = {
  exists: boolean;
  isDir: boolean;
};

export type ValidateProfileRootResult = {
  ok: boolean;
  reason: string;
};

type LegacyUserVaultProfileStore = UserVaultProfileMeta & {
  schemaVersion?: number;
  settings?: UserVaultProfileSettings | null;
};

type UserVaultProfileStore = UserVaultProfileMeta & {
  schemaVersion: number;
};

type MigrationResult<T> = {
  store: T;
  didMigrate: boolean;
};

type ProfileStoreMigrationResult = MigrationResult<UserVaultProfileStore> & {
  legacySettings: UserVaultProfileSettings | null;
};

export type UserVaultMetaStore = {
  schemaVersion: number;
  activeProfileId: string | null;
};

export type UserVaultProfileSummary = UserVaultProfileMeta & {
  path: string;
};

export type SpacedRepetitionProfileStore = {
  schemaVersion: number;
  byVaultId: Record<string, SpacedRepetitionStorage>;
  migratedVaultIds: string[];
};

type SpacedRepetitionRegistryStore = {
  schemaVersion: number;
  lastActiveUserId: string | null;
  legacyVaultIds: string[];
  migratedAt: string | null;
};

type SpacedRepetitionUserProgressStore = {
  schemaVersion: number;
  user: SpacedRepetitionUser;
  state: SpacedRepetitionUserState;
};

export type FastFlashcardProfileStore = {
  schemaVersion: number;
  sessions: FastFlashcardSessionSummary[];
  migratedFromAppData: boolean;
};

export type ExamRunProfileStore = {
  schemaVersion: number;
  runs: ExamRun[];
  migratedFromAppData: boolean;
};

export type ExamPointsProfileStore = ExamPointsProfilesStore;

const USER_VAULT_META_FILE = "user-vault.json";
const USER_VAULT_PROFILES_DIR = "profiles";
const USER_VAULT_USERS_DIR = "users";
const USER_VAULT_PROFILE_FILE = "profile.json";
const USER_VAULT_PROFILE_SETTINGS_FILE = "settings.json";
const USER_VAULT_SPACED_REPETITION_FILE = "spaced-repetition.json";
const USER_VAULT_SPACED_REPETITION_DIR = "spaced-repetition";
const USER_VAULT_SPACED_REPETITION_REGISTRY_FILE = "registry.json";
const USER_VAULT_SPACED_REPETITION_USERS_DIR = "users";
const USER_VAULT_SPACED_REPETITION_PROGRESS_FILE = "progress.json";
const USER_VAULT_FAST_FLASHCARD_FILE = "fast-flashcard.json";
const USER_VAULT_EXAM_RUNS_DIR = "exam-runs";
const USER_VAULT_EXAM_POINTS_PROFILES_FILE = "exam-points-profiles.json";

const USER_VAULT_PROFILE_SCHEMA_VERSION = USER_VAULT_SCHEMA_VERSION;
const USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION = 2;
const USER_VAULT_EXAM_RUNS_SCHEMA_VERSION = USER_VAULT_SCHEMA_VERSION;
const USER_VAULT_EXAM_POINTS_PROFILE_SCHEMA_VERSION =
  EXAM_POINTS_PROFILE_SCHEMA_VERSION;
const PROFILE_SCOPED_SPACED_REPETITION_KEY = "__profile__";

const isMissingPathError = (message: string) =>
  message.includes("Path does not exist") ||
  message.includes("Path is not a directory") ||
  message.includes("File not found");

const createEmptyUserVaultMeta = (): UserVaultMetaStore => ({
  schemaVersion: USER_VAULT_SCHEMA_VERSION,
  activeProfileId: null,
});

const hasProfileIdentity = async (profilePath: string): Promise<boolean> => {
  try {
    await invoke<string>("read_json_file", {
      path: joinPath(profilePath, USER_VAULT_PROFILE_FILE),
    });
    return true;
  } catch (error) {
    const message = asErrorMessage(error, "Unknown error");
    if (isMissingPathError(message)) {
      return false;
    }
    console.warn("Failed to inspect profile identity", message);
    return false;
  }
};

const readJsonFile = async <T,>(path: string, fallback: T): Promise<T> => {
  try {
    const raw = await invoke<string>("read_json_file", { path });
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

type JsonReadError = "missing" | "parse" | "unknown";

type JsonReadResult<T> = {
  value: T | null;
  error: JsonReadError | null;
};

const readJsonFileWithStatus = async <T,>(path: string): Promise<JsonReadResult<T>> => {
  try {
    const raw = await invoke<string>("read_json_file", { path });
    try {
      return { value: (JSON.parse(raw) as T) ?? null, error: null };
    } catch {
      return { value: null, error: "parse" };
    }
  } catch (error) {
    const message = asErrorMessage(error, "Unknown error");
    if (isMissingPathError(message)) {
      return { value: null, error: "missing" };
    }
    return { value: null, error: "unknown" };
  }
};

const buildJsonSiblingPath = (path: string, suffix: string) => {
  if (path.toLowerCase().endsWith(".json")) {
    return path.replace(/\.json$/i, `${suffix}.json`);
  }
  return `${path}.${suffix}.json`;
};

const buildCorruptBackupPath = (path: string) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return buildJsonSiblingPath(path, `.corrupt.${stamp}`);
};

const buildTempJsonPath = (path: string) =>
  buildJsonSiblingPath(path, `.tmp.${Date.now()}`);

const renameJsonFile = async (from: string, to: string) => {
  await invoke("rename_json_file", { from, to });
};

const writeJsonFile = async (path: string, payload: unknown) => {
  const contents = JSON.stringify(payload, null, 2);
  await invoke("write_json_file", { path, contents });
};

const writeJsonFileAtomic = async (path: string, payload: unknown) => {
  const contents = JSON.stringify(payload, null, 2);
  const tempPath = buildTempJsonPath(path);
  await invoke("write_json_file", { path: tempPath, contents });
  try {
    await renameJsonFile(tempPath, path);
  } catch (error) {
    await invoke("write_json_file", { path, contents });
    console.warn(
      "Failed to replace JSON file atomically",
      asErrorMessage(error, "Unknown error"),
    );
  }
};

const ensureDirectory = async (path: string) => {
  await invoke("ensure_directory", { path });
};

const getPathInfo = async (path: string): Promise<PathInfo> => {
  return invoke<PathInfo>("get_path_info", { path });
};

const listDirectories = async (path: string) => {
  const entries = await invoke<string[]>("list_directories", { path });
  return entries ?? [];
};

const listFiles = async (path: string) => {
  const entries = await invoke<string[]>("list_files", { path });
  return entries ?? [];
};

const deleteFile = async (path: string) => {
  await invoke("delete_file", { path });
};

const renameDirectory = async (from: string, to: string) => {
  await invoke("rename_directory", { from, to });
};

export const getOsUsername = async () => {
  try {
    const name = await invoke<string>("get_os_username");
    return typeof name === "string" ? name : "";
  } catch {
    return "";
  }
};

const resolveUserVaultMetaPath = (userVaultPath: string) =>
  joinPath(userVaultPath, USER_VAULT_META_FILE);

const resolveProfileMetaPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_PROFILE_FILE);

const resolveProfileSettingsPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_PROFILE_SETTINGS_FILE);

const resolveSpacedRepetitionPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_SPACED_REPETITION_FILE);

const resolveSpacedRepetitionRootPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_SPACED_REPETITION_DIR);

const resolveSpacedRepetitionRegistryPath = (profilePath: string) =>
  joinPath(
    resolveSpacedRepetitionRootPath(profilePath),
    USER_VAULT_SPACED_REPETITION_REGISTRY_FILE,
  );

const resolveSpacedRepetitionUsersRootPath = (profilePath: string) =>
  joinPath(
    resolveSpacedRepetitionRootPath(profilePath),
    USER_VAULT_SPACED_REPETITION_USERS_DIR,
  );

const buildSafeSpacedRepetitionUserFolderName = (userId: string) =>
  sanitizeProfileName(encodeURIComponent(userId)) || "user";

const resolveSpacedRepetitionUserProgressPath = (
  profilePath: string,
  userId: string,
) =>
  joinPath(
    resolveSpacedRepetitionUsersRootPath(profilePath),
    buildSafeSpacedRepetitionUserFolderName(userId),
    USER_VAULT_SPACED_REPETITION_PROGRESS_FILE,
  );

const resolveFastFlashcardPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_FAST_FLASHCARD_FILE);

const resolveExamRunsDir = (profileRootPath: string) =>
  joinPath(profileRootPath, USER_VAULT_EXAM_RUNS_DIR);

const resolveExamPointsProfilesPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_EXAM_POINTS_PROFILES_FILE);

const resolveProfileIdFromPath = (profilePath: string) => {
  const trimmed = profilePath.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || trimmed;
};

const resolveUserEntriesRootPaths = (profileRoot: string) => ({
  usersRoot: joinPath(profileRoot, USER_VAULT_USERS_DIR),
  profilesRoot: joinPath(profileRoot, USER_VAULT_PROFILES_DIR),
});

const listUserEntriesInRoot = async (
  root: string,
  exclude: Set<string> = new Set(),
): Promise<UserVaultProfileSummary[]> => {
  const entries = await listDirectories(root);
  const candidates = await Promise.all(
    entries
      .filter((entry) => !exclude.has(entry))
      .map(async (entry) => {
        const profilePath = joinPath(root, entry);
        if (!(await hasProfileIdentity(profilePath))) {
          return null;
        }
        const metaPath = resolveProfileMetaPath(profilePath);
        const meta = await readJsonFile<UserVaultProfileMeta | null>(metaPath, null);
        return { ...normalizeProfileMeta(entry, meta), path: profilePath };
      }),
  );
  return candidates.filter(Boolean) as UserVaultProfileSummary[];
};

const listUserEntriesSafe = async (
  root: string,
  exclude?: Set<string>,
): Promise<UserVaultProfileSummary[]> => {
  try {
    return await listUserEntriesInRoot(root, exclude ?? new Set());
  } catch (error) {
    const message = asErrorMessage(error, "Failed to scan user entries.");
    if (isMissingPathError(message)) {
      return [];
    }
    console.warn("Failed to scan user entries", message);
    return [];
  }
};

export const listUserVaultProfiles = async (
  userVaultPath: string,
): Promise<UserVaultProfileSummary[]> => {
  const { usersRoot, profilesRoot } = resolveUserEntriesRootPaths(userVaultPath);
  const [usersFolder, profilesFolder, directFolder] = await Promise.all([
    listUserEntriesSafe(usersRoot),
    listUserEntriesSafe(profilesRoot),
    listUserEntriesSafe(
      userVaultPath,
      new Set([USER_VAULT_USERS_DIR, USER_VAULT_PROFILES_DIR]),
    ),
  ]);
  const merged = new Map<string, UserVaultProfileSummary>();
  [...usersFolder, ...profilesFolder, ...directFolder].forEach((entry) => {
    if (!merged.has(entry.id)) {
      merged.set(entry.id, entry);
    }
  });
  return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
};

const DEFAULT_PROFILE_ID_PATTERN = /^(\d{4}-\d{2}-\d{2})_default(?:-\d+)?$/i;

const resolveParentPath = (value: string) => {
  const trimmed = value.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  parts.pop();
  return parts.join("/") || "/";
};

const resolveProfileUsername = (value: string, fallback: string) => {
  const sanitized = sanitizeProfileName(value.toLowerCase());
  if (sanitized && sanitized !== "default") {
    return sanitized;
  }
  return fallback || "user";
};

export const migrateDefaultProfileFolders = async (
  profileRoot: string,
): Promise<void> => {
  const { usersRoot, profilesRoot } = resolveUserEntriesRootPaths(profileRoot);
  const [usersFolder, profilesFolder, directFolder] = await Promise.all([
    listUserEntriesSafe(usersRoot),
    listUserEntriesSafe(profilesRoot),
    listUserEntriesSafe(
      profileRoot,
      new Set([USER_VAULT_USERS_DIR, USER_VAULT_PROFILES_DIR]),
    ),
  ]);
  const entries = [...usersFolder, ...profilesFolder, ...directFolder];
  if (entries.length === 0) {
    return;
  }
  const osUsername = await getOsUsername();
  const fallbackUsername = sanitizeProfileName(osUsername.toLowerCase()) || "user";
  const meta = await loadUserVaultMeta(profileRoot);
  let nextActive = meta.activeProfileId;

  for (const entry of entries) {
    const currentId = resolveProfileIdFromPath(entry.path);
    if (!DEFAULT_PROFILE_ID_PATTERN.test(currentId)) {
      continue;
    }
    const metaPath = resolveProfileMetaPath(entry.path);
    const storedProfile = await readJsonFile<Record<string, unknown> | null>(metaPath, null);
    const storedMeta = (storedProfile as UserVaultProfileMeta | null) ?? null;
    const normalizedMeta = normalizeProfileMeta(currentId, storedMeta);
    const parsed = parseProfileId(currentId);
    const dateStamp = parsed.dateStamp || normalizedMeta.createdAt.slice(0, 10);
    const username = resolveProfileUsername(normalizedMeta.name, fallbackUsername);
    const baseId = `${dateStamp}_${username}`;
    if (baseId === currentId) {
      continue;
    }
    const parentPath = resolveParentPath(entry.path);
    let candidate = baseId;
    let suffix = 1;
    while (true) {
      const targetPath = joinPath(parentPath, candidate);
      const info = await getPathInfo(targetPath);
      if (!info.exists) {
        break;
      }
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const targetPath = joinPath(parentPath, candidate);
    try {
      await renameDirectory(entry.path, targetPath);
    } catch (error) {
      console.warn(
        "Failed to rename default profile folder",
        asErrorMessage(error, "Unknown error"),
      );
      continue;
    }
    const legacySettings = normalizeProfileSettingsValue(
      storedProfile && typeof storedProfile === "object"
        ? (storedProfile as Record<string, unknown>).settings
        : null,
    );
    const settingsPath = resolveProfileSettingsPath(targetPath);
    if (hasNonEmptyProfileSettings(legacySettings)) {
      const settingsInfo = await getPathInfo(settingsPath);
      if (!settingsInfo.exists) {
        await writeJsonFileAtomic(settingsPath, legacySettings);
      }
    }
    await writeJsonFile(resolveProfileMetaPath(targetPath), {
      schemaVersion: USER_VAULT_PROFILE_SCHEMA_VERSION,
      id: candidate,
      name: username,
      createdAt: normalizedMeta.createdAt,
    });
    if (nextActive === currentId || nextActive === normalizedMeta.id) {
      nextActive = candidate;
    }
  }

  if (nextActive !== meta.activeProfileId) {
    await setActiveProfileId(profileRoot, nextActive ?? null);
  }
};

export type ProfileRootMigrationResult = {
  moved: boolean;
  conflict: boolean;
  error: string | null;
};

export const migrateLegacyProfileRoot = async (
  vaultPath: string,
): Promise<ProfileRootMigrationResult> => {
  const legacyRoot = joinPath(vaultPath, LEGACY_PROFILE_ROOT_DIR);
  const profileRoot = joinPath(vaultPath, PROFILE_ROOT_DIR);
  try {
    const [legacyInfo, profileInfo] = await Promise.all([
      invoke<PathInfo>("get_path_info", { path: legacyRoot }),
      invoke<PathInfo>("get_path_info", { path: profileRoot }),
    ]);
    if (legacyInfo.exists && profileInfo.exists) {
      return { moved: false, conflict: true, error: null };
    }
    if (legacyInfo.exists && !profileInfo.exists) {
      await invoke("move_directory", {
        vaultPath,
        fromRelativePath: LEGACY_PROFILE_ROOT_DIR,
        toRelativePath: PROFILE_ROOT_DIR,
      });
      return { moved: true, conflict: false, error: null };
    }
    return { moved: false, conflict: false, error: null };
  } catch (error) {
    return {
      moved: false,
      conflict: false,
      error: asErrorMessage(error, "Profile root migration failed."),
    };
  }
};

export const validateProfileRoot = async (
  profileRoot: string,
): Promise<ValidateProfileRootResult> => {
  return ensureProfileRoot(profileRoot);
};

export const ensureProfileRoot = async (
  profileRoot: string,
): Promise<ValidateProfileRootResult> => {
  try {
    const info = await invoke<PathInfo>("get_path_info", { path: profileRoot });
    if (!info.isDir) {
      if (!info.exists) {
        await ensureDirectory(profileRoot);
      } else {
        return { ok: false, reason: "Profile root is not a directory." };
      }
    }
  } catch (error) {
    const message = asErrorMessage(error, "Profile root could not be inspected.");
    if (isMissingPathError(message)) {
      try {
        await ensureDirectory(profileRoot);
      } catch (createError) {
        return {
          ok: false,
          reason: asErrorMessage(createError, "Profile root could not be created."),
        };
      }
    } else {
      return { ok: false, reason: message };
    }
  }

  const metaPath = resolveUserVaultMetaPath(profileRoot);
  const meta = await readJsonFileWithStatus<UserVaultMetaStore>(metaPath);
  if (
    meta.error ||
    !meta.value ||
    typeof meta.value !== "object" ||
    Array.isArray(meta.value)
  ) {
    try {
      await writeJsonFile(metaPath, createEmptyUserVaultMeta());
    } catch (error) {
      return {
        ok: false,
        reason: asErrorMessage(error, "Profile meta could not be initialized."),
      };
    }
  } else {
    const normalizedMeta: UserVaultMetaStore = {
      schemaVersion: USER_VAULT_SCHEMA_VERSION,
      activeProfileId:
        typeof meta.value.activeProfileId === "string"
          ? meta.value.activeProfileId
          : null,
    };
    const needsRewrite =
      normalizedMeta.schemaVersion !== meta.value.schemaVersion ||
      normalizedMeta.activeProfileId !== meta.value.activeProfileId;
    if (needsRewrite) {
      try {
        await writeJsonFile(metaPath, normalizedMeta);
      } catch (error) {
        return {
          ok: false,
          reason: asErrorMessage(error, "Profile meta could not be updated."),
        };
      }
    }
  }

  try {
    await listDirectories(profileRoot);
  } catch (error) {
    const message = asErrorMessage(error, "Profile root is not accessible.");
    if (isMissingPathError(message)) {
      try {
        await ensureDirectory(profileRoot);
      } catch (createError) {
        return {
          ok: false,
          reason: asErrorMessage(createError, "Profile root could not be created."),
        };
      }
      try {
        await listDirectories(profileRoot);
      } catch (listError) {
        return {
          ok: false,
          reason: asErrorMessage(listError, "Profile root is not accessible."),
        };
      }
    } else {
      return {
        ok: false,
        reason: message,
      };
    }
  }

  return { ok: true, reason: "" };
};

export const createEmptySpacedRepetitionStore = (): SpacedRepetitionProfileStore => ({
  schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
  byVaultId: {},
  migratedVaultIds: [],
});

export const createEmptyFastFlashcardStore = (): FastFlashcardProfileStore => ({
  schemaVersion: USER_VAULT_SCHEMA_VERSION,
  sessions: [],
  migratedFromAppData: false,
});

export const createEmptyExamRunStore = (): ExamRunProfileStore => ({
  schemaVersion: USER_VAULT_EXAM_RUNS_SCHEMA_VERSION,
  runs: [],
  migratedFromAppData: false,
});

const normalizeProfileMeta = (
  fallbackId: string,
  meta: UserVaultProfileMeta | null,
): UserVaultProfileMeta => {
  if (
    meta &&
    typeof meta.id === "string" &&
    typeof meta.name === "string" &&
    typeof meta.createdAt === "string"
  ) {
    return {
      id: meta.id,
      name: meta.name,
      createdAt: meta.createdAt,
    };
  }
  const fallback = parseProfileId(fallbackId);
  const createdAt = fallback.dateStamp
    ? `${fallback.dateStamp}T00:00:00.000Z`
    : new Date().toISOString();
  return { id: fallbackId, name: fallback.name, createdAt };
};

const PROFILE_META_KEYS = new Set(["schemaVersion", "id", "name", "createdAt"]);

const normalizeProfileSettingsValue = (
  value: unknown,
): UserVaultProfileSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UserVaultProfileSettings;
};

const hasNonEmptyProfileSettings = (
  value: UserVaultProfileSettings | null,
): value is UserVaultProfileSettings => {
  return Boolean(value && Object.keys(value).length > 0);
};

const migrateProfileStore = (
  value: unknown,
  fallbackId: string,
): ProfileStoreMigrationResult | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const storedVersion =
    typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 0;
  const meta = normalizeProfileMeta(fallbackId, candidate as UserVaultProfileMeta);
  const legacySettings = normalizeProfileSettingsValue(candidate.settings);
  const hasOnlyMetaKeys = Object.keys(candidate).every((key) =>
    PROFILE_META_KEYS.has(key),
  );
  const hasSameMeta =
    candidate.id === meta.id &&
    candidate.name === meta.name &&
    candidate.createdAt === meta.createdAt;
  const didMigrate =
    storedVersion !== USER_VAULT_PROFILE_SCHEMA_VERSION ||
    !hasSameMeta ||
    !hasOnlyMetaKeys;
  return {
    store: {
      schemaVersion: USER_VAULT_PROFILE_SCHEMA_VERSION,
      ...meta,
    },
    didMigrate,
    legacySettings,
  };
};

const migrateProfileMetadataStore = async (
  profilePath: string,
): Promise<ProfileStoreMigrationResult | null> => {
  const metaPath = resolveProfileMetaPath(profilePath);
  const stored = await readJsonFile<LegacyUserVaultProfileStore | null>(metaPath, null);
  const fallbackId = resolveProfileIdFromPath(profilePath);
  const migrated = migrateProfileStore(stored, fallbackId);
  if (!migrated) {
    return null;
  }
  if (!migrated.didMigrate) {
    return migrated;
  }
  try {
    await writeJsonFile(metaPath, migrated.store);
  } catch (error) {
    console.warn(
      "Failed to migrate user profile metadata",
      asErrorMessage(error, "Unknown error"),
    );
  }
  return migrated;
};

const normalizeSpacedRepetitionStore = (
  value: unknown,
): SpacedRepetitionProfileStore => {
  if (!value || typeof value !== "object") {
    return createEmptySpacedRepetitionStore();
  }
  const candidate = value as Partial<SpacedRepetitionProfileStore>;
  const byVaultIdRaw =
    candidate.byVaultId && typeof candidate.byVaultId === "object"
      ? (candidate.byVaultId as Record<string, unknown>)
      : {};
  const byVaultId = Object.fromEntries(
    Object.entries(byVaultIdRaw).map(([vaultId, storage]) => [
      vaultId,
      normalizeSpacedRepetitionStorage(storage),
    ]),
  );
  const migratedVaultIds = Array.isArray(candidate.migratedVaultIds)
    ? candidate.migratedVaultIds.filter((id) => typeof id === "string")
    : [];
  return {
    schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
    byVaultId,
    migratedVaultIds,
  };
};

const createEmptySpacedRepetitionStorage = (): SpacedRepetitionStorage => ({
  users: [],
  userStateById: {},
  lastActiveUserId: null,
});

const createEmptySpacedRepetitionRegistry =
  (): SpacedRepetitionRegistryStore => ({
    schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
    lastActiveUserId: null,
    legacyVaultIds: [],
    migratedAt: null,
  });

const normalizeCompletedPerDay = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, number] => {
        return typeof entry[1] === "number" && Number.isFinite(entry[1]);
      })
      .map(([key, count]) => [key, Math.max(0, Math.floor(count))]),
  );
};

const normalizeSpacedRepetitionUser = (
  value: unknown,
): SpacedRepetitionUser | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<SpacedRepetitionUser>;
  const id = typeof candidate.id === "string" ? candidate.id : "";
  const name = typeof candidate.name === "string" ? candidate.name : "";
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    createdAt:
      typeof candidate.createdAt === "string"
        ? candidate.createdAt
        : new Date().toISOString(),
  };
};

const normalizeSpacedRepetitionUserState = (
  value: unknown,
): SpacedRepetitionUserState => {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<SpacedRepetitionUserState>)
      : {};
  const cardStatesRaw =
    candidate.cardStates && typeof candidate.cardStates === "object"
      ? (candidate.cardStates as Record<string, unknown>)
      : {};
  return {
    cardStates: Object.fromEntries(
      Object.entries(cardStatesRaw).map(([cardId, progress]) => [
        cardId,
        normalizeSpacedRepetitionCardProgress(
          progress as Partial<SpacedRepetitionCardProgress>,
        ),
      ]),
    ),
    lastLoadedAt:
      typeof candidate.lastLoadedAt === "string" ? candidate.lastLoadedAt : null,
    completedPerDay: normalizeCompletedPerDay(candidate.completedPerDay),
  };
};

const normalizeSpacedRepetitionStorage = (
  value: unknown,
): SpacedRepetitionStorage => {
  if (!value || typeof value !== "object") {
    return createEmptySpacedRepetitionStorage();
  }
  const candidate = value as Partial<SpacedRepetitionStorage>;
  const users = Array.isArray(candidate.users)
    ? candidate.users
        .map((user) => normalizeSpacedRepetitionUser(user))
        .filter((user): user is SpacedRepetitionUser => user !== null)
    : [];
  const userIds = new Set(users.map((user) => user.id));
  const userStateByIdRaw =
    candidate.userStateById && typeof candidate.userStateById === "object"
      ? (candidate.userStateById as Record<string, unknown>)
      : {};
  const userStateById = Object.fromEntries(
    Object.entries(userStateByIdRaw)
      .filter(([userId]) => userIds.has(userId))
      .map(([userId, state]) => [
        userId,
        normalizeSpacedRepetitionUserState(state),
      ]),
  );
  const lastActiveUserId =
    typeof candidate.lastActiveUserId === "string" &&
    userIds.has(candidate.lastActiveUserId)
      ? candidate.lastActiveUserId
      : null;
  return { users, userStateById, lastActiveUserId };
};

const normalizeSpacedRepetitionRegistry = (
  value: unknown,
): SpacedRepetitionRegistryStore => {
  if (!value || typeof value !== "object") {
    return createEmptySpacedRepetitionRegistry();
  }
  const candidate = value as Partial<SpacedRepetitionRegistryStore>;
  return {
    schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
    lastActiveUserId:
      typeof candidate.lastActiveUserId === "string"
        ? candidate.lastActiveUserId
        : null,
    legacyVaultIds: Array.isArray(candidate.legacyVaultIds)
      ? candidate.legacyVaultIds.filter((id) => typeof id === "string")
      : [],
    migratedAt:
      typeof candidate.migratedAt === "string" ? candidate.migratedAt : null,
  };
};

const normalizeSpacedRepetitionUserProgressStore = (
  value: unknown,
): SpacedRepetitionUserProgressStore | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<SpacedRepetitionUserProgressStore>;
  const user = normalizeSpacedRepetitionUser(candidate.user);
  if (!user) {
    return null;
  }
  return {
    schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
    user,
    state: normalizeSpacedRepetitionUserState(candidate.state),
  };
};

const compareIsoTimestamp = (left: string | null, right: string | null) => {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  const normalizedLeft = Number.isNaN(leftTime) ? -1 : leftTime;
  const normalizedRight = Number.isNaN(rightTime) ? -1 : rightTime;
  return normalizedLeft - normalizedRight;
};

const mergeSpacedRepetitionCardProgress = (
  base: SpacedRepetitionCardProgress | undefined,
  incoming: SpacedRepetitionCardProgress,
) => {
  if (!base) {
    return incoming;
  }
  const reviewedCompare = compareIsoTimestamp(
    base.lastReviewedAt,
    incoming.lastReviewedAt,
  );
  if (reviewedCompare !== 0) {
    return reviewedCompare < 0 ? incoming : base;
  }
  if (base.attempts !== incoming.attempts) {
    return incoming.attempts > base.attempts ? incoming : base;
  }
  if (base.boxCanonical !== incoming.boxCanonical) {
    return incoming.boxCanonical > base.boxCanonical ? incoming : base;
  }
  return base;
};

const mergeCompletedPerDay = (
  base: Record<string, number>,
  incoming: Record<string, number>,
) => {
  const next = { ...base };
  Object.entries(incoming).forEach(([dateKey, count]) => {
    next[dateKey] = Math.max(next[dateKey] ?? 0, count);
  });
  return next;
};

const mergeSpacedRepetitionUserStates = (
  base: SpacedRepetitionUserState | undefined,
  incoming: SpacedRepetitionUserState,
): SpacedRepetitionUserState => {
  if (!base) {
    return incoming;
  }
  const cardStates = { ...base.cardStates };
  Object.entries(incoming.cardStates).forEach(([cardId, progress]) => {
    cardStates[cardId] = mergeSpacedRepetitionCardProgress(
      cardStates[cardId],
      progress,
    );
  });
  const lastLoadedAt =
    compareIsoTimestamp(base.lastLoadedAt, incoming.lastLoadedAt) < 0
      ? incoming.lastLoadedAt
      : base.lastLoadedAt;
  return {
    cardStates,
    lastLoadedAt,
    completedPerDay: mergeCompletedPerDay(
      base.completedPerDay,
      incoming.completedPerDay,
    ),
  };
};

const mergeSpacedRepetitionStorages = (
  base: SpacedRepetitionStorage,
  incoming: SpacedRepetitionStorage,
): SpacedRepetitionStorage => {
  const users = [...base.users];
  const userIds = new Set(users.map((user) => user.id));
  incoming.users.forEach((user) => {
    if (!userIds.has(user.id)) {
      users.push(user);
      userIds.add(user.id);
    }
  });
  const userStateById = { ...base.userStateById };
  Object.entries(incoming.userStateById).forEach(([userId, state]) => {
    if (!userIds.has(userId)) {
      return;
    }
    userStateById[userId] = mergeSpacedRepetitionUserStates(
      userStateById[userId],
      state,
    );
  });
  const lastActiveUserId =
    base.lastActiveUserId && userIds.has(base.lastActiveUserId)
      ? base.lastActiveUserId
      : incoming.lastActiveUserId && userIds.has(incoming.lastActiveUserId)
        ? incoming.lastActiveUserId
        : null;
  return { users, userStateById, lastActiveUserId };
};

const getSpacedRepetitionStorageScore = (storage: SpacedRepetitionStorage) => {
  const stateCount = Object.keys(storage.userStateById).length;
  const cardCount = Object.values(storage.userStateById).reduce(
    (count, state) => count + Object.keys(state.cardStates).length,
    0,
  );
  return (
    storage.users.length * 10 +
    stateCount * 3 +
    cardCount +
    (storage.lastActiveUserId ? 1 : 0)
  );
};

const selectLegacyLastActiveUserId = (
  byVaultId: Record<string, SpacedRepetitionStorage>,
  storage: SpacedRepetitionStorage,
) => {
  const userIds = new Set(storage.users.map((user) => user.id));
  const ranked = Object.entries(byVaultId).sort((left, right) => {
    return (
      getSpacedRepetitionStorageScore(right[1]) -
      getSpacedRepetitionStorageScore(left[1])
    );
  });
  for (const [, legacyStorage] of ranked) {
    const userId = legacyStorage.lastActiveUserId;
    if (userId && userIds.has(userId)) {
      return userId;
    }
  }
  return null;
};

const mergeSpacedRepetitionStorageEntries = (
  byVaultId: Record<string, SpacedRepetitionStorage>,
) => {
  const entries = Object.entries(byVaultId);
  const sortedEntries = [...entries].sort(([leftKey], [rightKey]) => {
    if (leftKey === PROFILE_SCOPED_SPACED_REPETITION_KEY) {
      return -1;
    }
    if (rightKey === PROFILE_SCOPED_SPACED_REPETITION_KEY) {
      return 1;
    }
    return leftKey.localeCompare(rightKey);
  });
  const storage = sortedEntries.reduce(
    (merged, [, storageEntry]) =>
      mergeSpacedRepetitionStorages(merged, storageEntry),
    createEmptySpacedRepetitionStorage(),
  );
  const legacyActiveUserId = selectLegacyLastActiveUserId(byVaultId, storage);
  return {
    storage: {
      ...storage,
      lastActiveUserId:
        storage.lastActiveUserId ?? legacyActiveUserId ?? storage.users[0]?.id ?? null,
    },
    vaultIds: entries.map(([vaultId]) => vaultId),
  };
};

const normalizeFastFlashcardStore = (value: unknown): FastFlashcardProfileStore => {
  if (!value || typeof value !== "object") {
    return createEmptyFastFlashcardStore();
  }
  const candidate = value as Partial<FastFlashcardProfileStore>;
  const sessions = Array.isArray(candidate.sessions)
    ? (candidate.sessions as FastFlashcardSessionSummary[])
    : [];
  const migratedFromAppData =
    typeof candidate.migratedFromAppData === "boolean"
      ? candidate.migratedFromAppData
      : false;
  return {
    schemaVersion: USER_VAULT_SCHEMA_VERSION,
    sessions,
    migratedFromAppData,
  };
};

const normalizeExamRunUserSlug = (value: string) => {
  const sanitized = sanitizeProfileName(value.toLowerCase());
  return sanitized || "user";
};

const formatRunTimestampForFilename = (value: string) => {
  const parsed = Date.parse(value);
  const date = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  const pad = (input: number) => String(input).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());
  const second = pad(date.getUTCSeconds());
  return `${year}-${month}-${day}T${hour}-${minute}-${second}`;
};

const formatDurationHms = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
};

const parseDurationHms = (value: string) => {
  const parts = value.split(":").map((entry) => Number(entry));
  if (parts.some((entry) => Number.isNaN(entry))) {
    return 0;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return Math.max(0, hours) * 3600000 + Math.max(0, minutes) * 60000 + Math.max(0, seconds) * 1000;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Math.max(0, minutes) * 60000 + Math.max(0, seconds) * 1000;
  }
  if (parts.length === 1) {
    return Math.max(0, parts[0]) * 1000;
  }
  return 0;
};

const formatYamlString = (value: string) => JSON.stringify(value);

const parseScoreValue = (value: string) => {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const achieved = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(achieved) || !Number.isFinite(max)) {
    return null;
  }
  return { achievedPoints: achieved, maxPoints: max };
};

const resolveExamRunStatusCode = (run: ExamRun) => {
  if (typeof run.statusValue === "number" && Number.isFinite(run.statusValue)) {
    return Math.max(0, Math.min(6, Math.floor(run.statusValue)));
  }
  if (typeof run.statusValue === "string") {
    const parsed = Number(run.statusValue);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(6, Math.floor(parsed)));
    }
  }
  return resolveExamStatusDescriptor(run.percent).value;
};

const buildExamRunFrontmatter = (run: ExamRun) => {
  const userValue = run.userName || "Unknown";
  const examFileValue = run.examFilePath || "";
  const scoreValue = `${run.achievedPoints}/${run.maxPoints}`;
  const percentValue =
    Number.isFinite(run.percent) && !Number.isNaN(run.percent) ? run.percent : 0;
  const statusValue = resolveExamRunStatusCode(run);
  const durationValue = formatDurationHms(run.durationMs);
  return [
    "---",
    `date: ${run.endedAt}`,
    `user: ${formatYamlString(userValue)}`,
    `exam_file: ${formatYamlString(examFileValue)}`,
    `score: ${formatYamlString(scoreValue)}`,
    `percent: ${percentValue}`,
    `status: ${statusValue}`,
    `duration: ${formatYamlString(durationValue)}`,
    `id: ${formatYamlString(run.id)}`,
    "---",
    "",
  ].join("\n");
};

const parseExamRunFrontmatter = (contents: string, filePath: string): ExamRun | null => {
  const doc = parseFrontmatterDocument(contents);
  if (doc.error || !doc.hasFrontmatter) {
    return null;
  }
  const map = new Map(
    doc.properties.map((property) => [property.key.toLowerCase(), property.value]),
  );
  const getString = (key: string) => {
    const value = map.get(key);
    return typeof value === "string" ? value : null;
  };
  const getNumber = (key: string) => {
    const value = map.get(key);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const id = getString("id") ?? "";
  const endedAt = getString("date") ?? "";
  const examFilePath = getString("exam_file") ?? "";
  if (!id || !endedAt || !examFilePath) {
    return null;
  }
  const endedAtValue = Date.parse(endedAt);
  if (Number.isNaN(endedAtValue)) {
    return null;
  }
  const userName = getString("user") ?? "Unknown";
  const scoreRaw = getString("score");
  const scoreParsed = scoreRaw ? parseScoreValue(scoreRaw) : null;
  const scoreNumber = getNumber("score");
  const achievedPoints = scoreParsed?.achievedPoints ?? (scoreNumber ?? 0);
  const maxPoints = scoreParsed?.maxPoints ?? 0;
  const percent = getNumber("percent") ?? (maxPoints > 0 ? (achievedPoints / maxPoints) * 100 : 0);
  const statusValueRaw = map.get("status");
  const statusValue =
    typeof statusValueRaw === "number" && Number.isFinite(statusValueRaw)
      ? Math.max(0, Math.min(6, Math.floor(statusValueRaw)))
      : typeof statusValueRaw === "string" && statusValueRaw.trim() !== ""
        ? Number(statusValueRaw.trim())
        : null;
  const resolvedStatusValue =
    statusValue !== null && Number.isFinite(statusValue)
      ? Math.max(0, Math.min(6, Math.floor(statusValue)))
      : resolveExamStatusDescriptor(percent).value;
  const passed = percent >= 50;
  const duration = getString("duration") ?? "";
  const durationMs = duration ? parseDurationHms(duration) : 0;
  const startedAt =
    durationMs > 0
      ? new Date(Math.max(0, endedAtValue - durationMs)).toISOString()
      : new Date(endedAtValue).toISOString();

  return {
    id,
    startedAt,
    endedAt: new Date(endedAtValue).toISOString(),
    durationMs,
    userId: null,
    userName,
    examFilePath,
    tasksDetected: 0,
    maxPoints,
    achievedPoints,
    percent,
    passed,
    grade: null,
    statusValue: resolvedStatusValue,
    gradeScaleId: "standard-1-6",
    pointsProfileId: null,
    pointsProfileName: null,
    pointsProfileVersion: null,
    pointsProfileAssignments: [],
    filePath,
  };
};

const buildExamRunFileName = (run: ExamRun) => {
  const userSlug = normalizeExamRunUserSlug(run.userName || "user");
  const runIdSlug = sanitizeProfileName(run.id.toLowerCase()) || "run";
  const timestamp = formatRunTimestampForFilename(run.endedAt || new Date().toISOString());
  return `${userSlug}_${timestamp}_run-${runIdSlug}.md`;
};

const resolveUniqueExamRunPath = async (
  profilePath: string,
  run: ExamRun,
): Promise<string> => {
  const dir = resolveExamRunsDir(profilePath);
  await ensureDirectory(dir);
  const baseName = buildExamRunFileName(run);
  let candidate = baseName;
  let suffix = 1;
  while (true) {
    const candidatePath = joinPath(dir, candidate);
    const info = await getPathInfo(candidatePath);
    if (!info.exists) {
      return candidatePath;
    }
    candidate = baseName.replace(/\.md$/i, `-${suffix}.md`);
    suffix += 1;
  }
};

const loadExamRunMarkdownEntries = async (
  profilePath: string,
): Promise<ExamRun[]> => {
  const dir = resolveExamRunsDir(profilePath);
  let files: string[] = [];
  try {
    files = await listFiles(dir);
  } catch (error) {
    const message = asErrorMessage(error, "Failed to list exam runs.");
    if (!isMissingPathError(message)) {
      console.warn("Failed to list exam run files", message);
    }
    return [];
  }
  const markdownFiles = files.filter((entry) => entry.toLowerCase().endsWith(".md"));
  const entries = await Promise.all(
    markdownFiles.map(async (filePath) => {
      try {
        const contents = await invoke<string>("read_text_file", { path: filePath });
        return parseExamRunFrontmatter(contents, filePath);
      } catch (error) {
        console.warn(
          "Failed to read exam run markdown",
          asErrorMessage(error, "Unknown error"),
        );
        return null;
      }
    }),
  );
  return entries.filter((entry): entry is ExamRun => entry !== null);
};

const writeExamRunMarkdownEntry = async (
  profilePath: string,
  run: ExamRun,
): Promise<string> => {
  const filePath = await resolveUniqueExamRunPath(profilePath, run);
  const contents = buildExamRunFrontmatter(run);
  await invoke("write_text_file", { path: filePath, contents });
  return filePath;
};

const deleteExamRunMarkdownFiles = async (profilePath: string) => {
  const dir = resolveExamRunsDir(profilePath);
  let files: string[] = [];
  try {
    files = await listFiles(dir);
  } catch (error) {
    const message = asErrorMessage(error, "Failed to list exam runs.");
    if (!isMissingPathError(message)) {
      console.warn("Failed to list exam run files", message);
    }
    return;
  }
  const markdownFiles = files.filter((entry) => entry.toLowerCase().endsWith(".md"));
  await Promise.all(
    markdownFiles.map(async (filePath) => {
      try {
        await deleteFile(filePath);
      } catch (error) {
        console.warn(
          "Failed to delete exam run markdown",
          asErrorMessage(error, "Unknown error"),
        );
      }
    }),
  );
};

export const resetExamRunMarkdownHistory = async (profilePath: string) => {
  await deleteExamRunMarkdownFiles(profilePath);
};

const migrateExamPointsProfileStore = (
  value: unknown,
): MigrationResult<ExamPointsProfileStore> => {
  if (!value || typeof value !== "object") {
    return { store: createEmptyExamPointsProfilesStore(), didMigrate: true };
  }
  const candidate = value as Partial<ExamPointsProfileStore>;
  const storedVersion =
    typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 0;
  const rawProfiles = Array.isArray(candidate.profiles) ? candidate.profiles : [];
  const store = normalizeExamPointsProfilesStore(candidate);
  const didMigrate =
    storedVersion !== USER_VAULT_EXAM_POINTS_PROFILE_SCHEMA_VERSION ||
    !Array.isArray(candidate.profiles) ||
    rawProfiles.length !== store.profiles.length ||
    candidate.defaultProfileId !== store.defaultProfileId;
  return { store, didMigrate };
};

export const loadUserVaultMeta = async (
  userVaultPath: string,
): Promise<UserVaultMetaStore> => {
  const metaPath = resolveUserVaultMetaPath(userVaultPath);
  const meta = await readJsonFile<UserVaultMetaStore>(metaPath, createEmptyUserVaultMeta());
  return {
    schemaVersion: USER_VAULT_SCHEMA_VERSION,
    activeProfileId:
      typeof meta.activeProfileId === "string" ? meta.activeProfileId : null,
  };
};

export const saveUserVaultMeta = async (
  userVaultPath: string,
  meta: UserVaultMetaStore,
) => {
  const metaPath = resolveUserVaultMetaPath(userVaultPath);
  await writeJsonFile(metaPath, {
    schemaVersion: USER_VAULT_SCHEMA_VERSION,
    activeProfileId: meta.activeProfileId ?? null,
  });
};

const resolveUserEntriesRootForWrite = async (
  profileRoot: string,
): Promise<string> => {
  const { usersRoot, profilesRoot } = resolveUserEntriesRootPaths(profileRoot);
  try {
    const [usersInfo, profilesInfo] = await Promise.all([
      invoke<PathInfo>("get_path_info", { path: usersRoot }),
      invoke<PathInfo>("get_path_info", { path: profilesRoot }),
    ]);
    if (usersInfo.exists && usersInfo.isDir) {
      return usersRoot;
    }
    if (profilesInfo.exists && profilesInfo.isDir) {
      return profilesRoot;
    }
  } catch (error) {
    console.warn(
      "Failed to inspect user entries root",
      asErrorMessage(error, "Unknown error"),
    );
  }
  return usersRoot;
};

export const createUserVaultProfile = async (
  userVaultPath: string,
  name: string,
): Promise<UserVaultProfileSummary> => {
  const sanitized = sanitizeProfileName(name);
  if (!sanitized) {
    throw new Error("Profile name is required.");
  }
  const baseId = buildProfileId(sanitized) ?? sanitized;
  const entriesRoot = await resolveUserEntriesRootForWrite(userVaultPath);
  await ensureDirectory(entriesRoot);
  let candidate = baseId;
  let suffix = 1;
  while (true) {
    const profilePath = joinPath(entriesRoot, candidate);
    const info = await invoke<PathInfo>("get_path_info", { path: profilePath });
    if (!info.exists) {
      break;
    }
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  const profilePath = joinPath(entriesRoot, candidate);
  await ensureDirectory(profilePath);
  const meta: UserVaultProfileMeta = {
    id: candidate,
    name: sanitized,
    createdAt: new Date().toISOString(),
  };
  await writeJsonFile(resolveProfileMetaPath(profilePath), {
    schemaVersion: USER_VAULT_PROFILE_SCHEMA_VERSION,
    ...meta,
  });
  return { ...meta, path: profilePath };
};

export const setActiveProfileId = async (
  userVaultPath: string,
  profileId: string | null,
) => {
  await saveUserVaultMeta(userVaultPath, {
    schemaVersion: USER_VAULT_SCHEMA_VERSION,
    activeProfileId: profileId,
  });
};

export const loadProfileData = async (
  profilePath: string,
): Promise<UserVaultProfileData> => {
  const spacedRepetition = await loadSpacedRepetitionStore(profilePath);
  const fastFlashcard = await loadFastFlashcardStore(profilePath);
  const examRuns = await loadExamRunStore(profilePath);
  const settings = await loadProfileSettings(profilePath);
  return {
    spacedRepetitionByVaultId: spacedRepetition.byVaultId,
    fastFlashcardSessions: fastFlashcard.sessions,
    examRuns: examRuns.runs,
    settings,
  };
};

export const loadProfileSettings = async (
  profilePath: string,
): Promise<UserVaultProfileSettings | null> => {
  const settingsPath = resolveProfileSettingsPath(profilePath);
  const settingsResult =
    await readJsonFileWithStatus<UserVaultProfileSettings | null>(settingsPath);
  const storedSettings = normalizeProfileSettingsValue(settingsResult.value);
  if (hasNonEmptyProfileSettings(storedSettings)) {
    return storedSettings;
  }
  if (settingsResult.error !== "missing") {
    return null;
  }
  const migrated = await migrateProfileMetadataStore(profilePath);
  if (!migrated || !hasNonEmptyProfileSettings(migrated.legacySettings)) {
    return null;
  }
  try {
    await writeJsonFileAtomic(settingsPath, migrated.legacySettings);
  } catch (error) {
    console.warn(
      "Failed to migrate user profile settings",
      asErrorMessage(error, "Unknown error"),
    );
  }
  return migrated.legacySettings;
};

export const saveProfileSettings = async (
  profilePath: string,
  settings: UserVaultProfileSettings | null,
): Promise<boolean> => {
  try {
    const migrated = await migrateProfileMetadataStore(profilePath);
    if (!migrated) {
      const fallbackId = resolveProfileIdFromPath(profilePath);
      const meta = normalizeProfileMeta(fallbackId, null);
      await writeJsonFile(resolveProfileMetaPath(profilePath), {
        schemaVersion: USER_VAULT_PROFILE_SCHEMA_VERSION,
        ...meta,
      });
    }
    const settingsPath = resolveProfileSettingsPath(profilePath);
    const normalizedSettings = normalizeProfileSettingsValue(settings);
    if (hasNonEmptyProfileSettings(normalizedSettings)) {
      await writeJsonFileAtomic(settingsPath, normalizedSettings);
      return true;
    }
    const settingsInfo = await getPathInfo(settingsPath);
    if (settingsInfo.exists && !settingsInfo.isDir) {
      await deleteFile(settingsPath);
    }
    return true;
  } catch (error) {
    console.error(
      "Failed to save user profile settings",
      asErrorMessage(error, "Unknown error"),
    );
    return false;
  }
};

export const loadSpacedRepetitionStore = async (
  profilePath: string,
): Promise<SpacedRepetitionProfileStore> => {
  const registryPath = resolveSpacedRepetitionRegistryPath(profilePath);
  const registryResult =
    await readJsonFileWithStatus<SpacedRepetitionRegistryStore>(registryPath);
  const registry = normalizeSpacedRepetitionRegistry(registryResult.value);
  const usersRoot = resolveSpacedRepetitionUsersRootPath(profilePath);
  let userFolders: string[] = [];
  try {
    userFolders = await listDirectories(usersRoot);
  } catch (error) {
    const message = asErrorMessage(error, "Failed to scan spaced repetition users.");
    if (!isMissingPathError(message)) {
      console.warn("Failed to scan spaced repetition users", message);
    }
  }

  const progressEntries = await Promise.all(
    userFolders.map(async (folder) => {
      const progressPath = joinPath(
        usersRoot,
        folder,
        USER_VAULT_SPACED_REPETITION_PROGRESS_FILE,
      );
      const { value, error } =
        await readJsonFileWithStatus<SpacedRepetitionUserProgressStore>(
          progressPath,
        );
      if (error) {
        if (error !== "missing") {
          console.warn("Failed to read spaced repetition progress", progressPath);
        }
        return null;
      }
      return normalizeSpacedRepetitionUserProgressStore(value);
    }),
  );

  const folderStorage = progressEntries.reduce((storage, entry) => {
    if (!entry) {
      return storage;
    }
    return mergeSpacedRepetitionStorages(storage, {
      users: [entry.user],
      userStateById: { [entry.user.id]: entry.state },
      lastActiveUserId: null,
    });
  }, createEmptySpacedRepetitionStorage());

  const migratedVaultIds = new Set(registry.legacyVaultIds);
  const legacyPath = resolveSpacedRepetitionPath(profilePath);
  const legacyStore = normalizeSpacedRepetitionStore(
    await readJsonFile<SpacedRepetitionProfileStore | null>(legacyPath, null),
  );
  const pendingLegacyByVaultId = Object.fromEntries(
    Object.entries(legacyStore.byVaultId).filter(
      ([vaultId]) => !migratedVaultIds.has(vaultId),
    ),
  );
  const pendingLegacyVaultIds = Object.keys(pendingLegacyByVaultId);
  const pendingLegacy =
    pendingLegacyVaultIds.length > 0
      ? mergeSpacedRepetitionStorageEntries(pendingLegacyByVaultId)
      : { storage: createEmptySpacedRepetitionStorage(), vaultIds: [] };

  pendingLegacyVaultIds.forEach((vaultId) => migratedVaultIds.add(vaultId));

  let storage = mergeSpacedRepetitionStorages(
    folderStorage,
    pendingLegacy.storage,
  );
  const userIds = new Set(storage.users.map((user) => user.id));
  const registryActiveUserId =
    registry.lastActiveUserId && userIds.has(registry.lastActiveUserId)
      ? registry.lastActiveUserId
      : null;
  const legacyActiveUserId = selectLegacyLastActiveUserId(
    pendingLegacyByVaultId,
    storage,
  );
  storage = {
    ...storage,
    lastActiveUserId:
      registryActiveUserId ?? legacyActiveUserId ?? storage.users[0]?.id ?? null,
  };

  const store: SpacedRepetitionProfileStore = {
    schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
    byVaultId: { [PROFILE_SCOPED_SPACED_REPETITION_KEY]: storage },
    migratedVaultIds: Array.from(migratedVaultIds),
  };

  const needsFolderWrite =
    pendingLegacyVaultIds.length > 0 || registryResult.error !== null;
  if (needsFolderWrite) {
    await saveSpacedRepetitionStore(profilePath, store);
  }

  return store;
};

export const saveSpacedRepetitionStore = async (
  profilePath: string,
  store: SpacedRepetitionProfileStore,
) => {
  try {
    const { storage, vaultIds } = mergeSpacedRepetitionStorageEntries(
      store.byVaultId,
    );
    const registryPath = resolveSpacedRepetitionRegistryPath(profilePath);
    const previousRegistry = normalizeSpacedRepetitionRegistry(
      (
        await readJsonFileWithStatus<SpacedRepetitionRegistryStore>(registryPath)
      ).value,
    );
    const legacyVaultIds = Array.from(
      new Set([
        ...previousRegistry.legacyVaultIds,
        ...(Array.isArray(store.migratedVaultIds) ? store.migratedVaultIds : []),
        ...vaultIds.filter(
          (vaultId) => vaultId !== PROFILE_SCOPED_SPACED_REPETITION_KEY,
        ),
      ]),
    );
    const root = resolveSpacedRepetitionRootPath(profilePath);
    const usersRoot = resolveSpacedRepetitionUsersRootPath(profilePath);
    await ensureDirectory(root);
    await ensureDirectory(usersRoot);

    const activeFolderNames = new Set<string>();
    await Promise.all(
      storage.users.map(async (user) => {
        const state =
          storage.userStateById[user.id] ?? normalizeSpacedRepetitionUserState(null);
        const folderName = buildSafeSpacedRepetitionUserFolderName(user.id);
        activeFolderNames.add(folderName);
        const progressPath = resolveSpacedRepetitionUserProgressPath(
          profilePath,
          user.id,
        );
        await ensureDirectory(joinPath(usersRoot, folderName));
        await writeJsonFileAtomic(progressPath, {
          schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
          user,
          state,
        });
      }),
    );

    const existingFolders = await listDirectories(usersRoot);
    await Promise.all(
      existingFolders
        .filter((folder) => !activeFolderNames.has(folder))
        .map(async (folder) => {
          const progressPath = joinPath(
            usersRoot,
            folder,
            USER_VAULT_SPACED_REPETITION_PROGRESS_FILE,
          );
          const info = await getPathInfo(progressPath);
          if (!info.exists || info.isDir) {
            return;
          }
          const backupPath = buildJsonSiblingPath(
            progressPath,
            `.deleted.${Date.now()}`,
          );
          try {
            await renameJsonFile(progressPath, backupPath);
          } catch (error) {
            console.warn(
              "Failed to archive deleted spaced repetition user",
              asErrorMessage(error, "Unknown error"),
            );
          }
        }),
    );

    await writeJsonFileAtomic(registryPath, {
      schemaVersion: USER_VAULT_SPACED_REPETITION_SCHEMA_VERSION,
      lastActiveUserId: storage.lastActiveUserId ?? null,
      legacyVaultIds,
      migratedAt:
        previousRegistry.migratedAt ??
        (legacyVaultIds.length > 0 ? new Date().toISOString() : null),
    });
  } catch (error) {
    console.error(
      "Failed to save spaced repetition user vault data",
      asErrorMessage(error, "Unknown error"),
    );
  }
};

export const loadFastFlashcardStore = async (
  profilePath: string,
): Promise<FastFlashcardProfileStore> => {
  const path = resolveFastFlashcardPath(profilePath);
  const store = await readJsonFile<FastFlashcardProfileStore>(
    path,
    createEmptyFastFlashcardStore(),
  );
  return normalizeFastFlashcardStore(store);
};

export const saveFastFlashcardStore = async (
  profilePath: string,
  store: FastFlashcardProfileStore,
) => {
  try {
    await writeJsonFile(resolveFastFlashcardPath(profilePath), {
      ...store,
      schemaVersion: USER_VAULT_SCHEMA_VERSION,
    });
  } catch (error) {
    console.error(
      "Failed to save fast flashcard user vault data",
      asErrorMessage(error, "Unknown error"),
    );
  }
};

export const loadExamPointsProfileStore = async (
  profilePath: string,
): Promise<ExamPointsProfileStore> => {
  const path = resolveExamPointsProfilesPath(profilePath);
  const { value, error } = await readJsonFileWithStatus<ExamPointsProfileStore>(path);
  if (error) {
    if (error === "parse") {
      const backupPath = buildCorruptBackupPath(path);
      try {
        await renameJsonFile(path, backupPath);
      } catch (renameError) {
        console.warn(
          "Failed to archive corrupt exam points profile store",
          asErrorMessage(renameError, "Unknown error"),
        );
      }
    }
    const empty = createEmptyExamPointsProfilesStore();
    try {
      await writeJsonFileAtomic(path, empty);
    } catch (writeError) {
      console.warn(
        "Failed to recover exam points profile store",
        asErrorMessage(writeError, "Unknown error"),
      );
    }
    return empty;
  }
  const { store, didMigrate } = migrateExamPointsProfileStore(value);
  if (didMigrate) {
    try {
      await writeJsonFileAtomic(path, store);
    } catch (writeError) {
      console.warn(
        "Failed to migrate exam points profile store",
        asErrorMessage(writeError, "Unknown error"),
      );
    }
  }
  return store;
};

export const saveExamPointsProfileStore = async (
  profilePath: string,
  store: ExamPointsProfileStore,
) => {
  try {
    const normalized = normalizeExamPointsProfilesStore(store);
    await writeJsonFileAtomic(resolveExamPointsProfilesPath(profilePath), {
      ...normalized,
      schemaVersion: USER_VAULT_EXAM_POINTS_PROFILE_SCHEMA_VERSION,
    });
  } catch (error) {
    console.error(
      "Failed to save exam points profile store",
      asErrorMessage(error, "Unknown error"),
    );
  }
};

export const loadExamRunStore = async (
  profileRootPath: string,
): Promise<ExamRunProfileStore> => {
  const runs = await loadExamRunMarkdownEntries(profileRootPath);
  return {
    schemaVersion: USER_VAULT_EXAM_RUNS_SCHEMA_VERSION,
    runs,
    migratedFromAppData: false,
  };
};

export const saveExamRunStore = async (
  profileRootPath: string,
  store: ExamRunProfileStore,
) => {
  try {
    await deleteExamRunMarkdownFiles(profileRootPath);
    await Promise.all(
      store.runs.map(async (run) => {
        await writeExamRunMarkdownEntry(profileRootPath, run);
      }),
    );
  } catch (error) {
    console.error(
      "Failed to save exam run user vault data",
      asErrorMessage(error, "Unknown error"),
    );
  }
};

export const appendExamRunStore = async (
  profileRootPath: string,
  run: ExamRun,
): Promise<string | null> => {
  try {
    const filePath = await writeExamRunMarkdownEntry(profileRootPath, run);
    return filePath;
  } catch (error) {
    console.warn(
      "Failed to append exam run store",
      asErrorMessage(error, "Unknown error"),
    );
    return null;
  }
};

export const deleteExamRunStoreEntry = async (
  profileRootPath: string,
  runId: string,
  filePath?: string | null,
): Promise<boolean> => {
  try {
    let targetPath = filePath ?? "";
    if (!targetPath) {
      const entries = await loadExamRunMarkdownEntries(profileRootPath);
      targetPath = entries.find((entry) => entry.id === runId)?.filePath ?? "";
    }
    if (!targetPath) {
      return true;
    }
    await deleteFile(targetPath);
    return true;
  } catch (error) {
    console.warn(
      "Failed to delete exam run store entry",
      asErrorMessage(error, "Unknown error"),
    );
    return false;
  }
};
