/**
 * @file apps/fmd-desktop/src/features/user-vault/storage.ts
 *
 * Zweck:
 * - Dateizugriff fuer den User Vault.
 */

import { invoke } from "@tauri-apps/api/core";
import { asErrorMessage } from "../../lib/errors";
import { joinPath } from "../../lib/path";
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
import type { ExamRun } from "../../lib/examRuns";
import type { SpacedRepetitionStorage } from "../spaced-repetition/logic";

type PathInfo = {
  exists: boolean;
  isDir: boolean;
};

export type ValidateProfileRootResult = {
  ok: boolean;
  reason: string;
};

type UserVaultProfileStore = UserVaultProfileMeta & {
  schemaVersion?: number;
  settings?: UserVaultProfileSettings | null;
};

type MigrationResult<T> = {
  store: T;
  didMigrate: boolean;
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

const USER_VAULT_META_FILE = "user-vault.json";
const USER_VAULT_PROFILES_DIR = "profiles";
const USER_VAULT_USERS_DIR = "users";
const USER_VAULT_PROFILE_FILE = "profile.json";
const USER_VAULT_SPACED_REPETITION_FILE = "spaced-repetition.json";
const USER_VAULT_FAST_FLASHCARD_FILE = "fast-flashcard.json";
const USER_VAULT_EXAM_RUNS_FILE = "exam-runs.json";

const USER_VAULT_PROFILE_SCHEMA_VERSION = USER_VAULT_SCHEMA_VERSION;
const USER_VAULT_EXAM_RUNS_SCHEMA_VERSION = USER_VAULT_SCHEMA_VERSION;

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

const listDirectories = async (path: string) => {
  const entries = await invoke<string[]>("list_directories", { path });
  return entries ?? [];
};

const resolveUserVaultMetaPath = (userVaultPath: string) =>
  joinPath(userVaultPath, USER_VAULT_META_FILE);

const resolveProfileMetaPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_PROFILE_FILE);

const resolveSpacedRepetitionPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_SPACED_REPETITION_FILE);

const resolveFastFlashcardPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_FAST_FLASHCARD_FILE);

const resolveExamRunsPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_EXAM_RUNS_FILE);

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
  schemaVersion: USER_VAULT_SCHEMA_VERSION,
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
    return meta;
  }
  const fallback = parseProfileId(fallbackId);
  const createdAt = fallback.dateStamp
    ? `${fallback.dateStamp}T00:00:00.000Z`
    : new Date().toISOString();
  return { id: fallbackId, name: fallback.name, createdAt };
};

const migrateProfileStore = (
  value: unknown,
  fallbackId: string,
): MigrationResult<UserVaultProfileStore> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const storedVersion =
    typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 0;
  const meta = normalizeProfileMeta(fallbackId, candidate as UserVaultProfileMeta);
  const settingsCandidate = candidate.settings;
  const settings =
    settingsCandidate &&
    typeof settingsCandidate === "object" &&
    !Array.isArray(settingsCandidate)
      ? (settingsCandidate as UserVaultProfileSettings)
      : null;
  const didMigrate =
    storedVersion !== USER_VAULT_PROFILE_SCHEMA_VERSION ||
    settingsCandidate === undefined ||
    settingsCandidate !== settings;
  return {
    store: {
      ...(candidate as UserVaultProfileStore),
      ...meta,
      schemaVersion: USER_VAULT_PROFILE_SCHEMA_VERSION,
      settings,
    },
    didMigrate,
  };
};

const normalizeSpacedRepetitionStore = (
  value: unknown,
): SpacedRepetitionProfileStore => {
  if (!value || typeof value !== "object") {
    return createEmptySpacedRepetitionStore();
  }
  const candidate = value as Partial<SpacedRepetitionProfileStore>;
  const byVaultId =
    candidate.byVaultId && typeof candidate.byVaultId === "object"
      ? (candidate.byVaultId as Record<string, SpacedRepetitionStorage>)
      : {};
  const migratedVaultIds = Array.isArray(candidate.migratedVaultIds)
    ? candidate.migratedVaultIds.filter((id) => typeof id === "string")
    : [];
  return {
    schemaVersion: USER_VAULT_SCHEMA_VERSION,
    byVaultId,
    migratedVaultIds,
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

const normalizeExamRun = (value: unknown): ExamRun | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<ExamRun>;
  const id = typeof candidate.id === "string" ? candidate.id : "";
  const startedAt = typeof candidate.startedAt === "string" ? candidate.startedAt : "";
  const endedAt = typeof candidate.endedAt === "string" ? candidate.endedAt : "";
  if (!id || !startedAt || !endedAt) {
    return null;
  }
  const grade =
    typeof candidate.grade === "string"
      ? candidate.grade
      : typeof candidate.grade === "number" && Number.isFinite(candidate.grade)
        ? String(candidate.grade)
        : null;
  return {
    id,
    startedAt,
    endedAt,
    durationMs:
      typeof candidate.durationMs === "number" && Number.isFinite(candidate.durationMs)
        ? candidate.durationMs
        : 0,
    userId: typeof candidate.userId === "string" ? candidate.userId : null,
    userName: typeof candidate.userName === "string" ? candidate.userName : "Unknown",
    examFilePath:
      typeof candidate.examFilePath === "string" ? candidate.examFilePath : "",
    tasksDetected:
      typeof candidate.tasksDetected === "number" &&
      Number.isFinite(candidate.tasksDetected)
        ? candidate.tasksDetected
        : 0,
    maxPoints:
      typeof candidate.maxPoints === "number" && Number.isFinite(candidate.maxPoints)
        ? candidate.maxPoints
        : 0,
    achievedPoints:
      typeof candidate.achievedPoints === "number" &&
      Number.isFinite(candidate.achievedPoints)
        ? candidate.achievedPoints
        : 0,
    percent:
      typeof candidate.percent === "number" && Number.isFinite(candidate.percent)
        ? candidate.percent
        : 0,
    passed: typeof candidate.passed === "boolean" ? candidate.passed : false,
    grade,
    gradeScaleId:
      candidate.gradeScaleId === "standard-1-6"
        ? candidate.gradeScaleId
        : "standard-1-6",
  };
};

const migrateExamRunStore = (
  value: unknown,
): MigrationResult<ExamRunProfileStore> => {
  if (!value || typeof value !== "object") {
    return { store: createEmptyExamRunStore(), didMigrate: true };
  }
  const candidate = value as Partial<ExamRunProfileStore>;
  const storedVersion =
    typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 0;
  const rawRuns = Array.isArray(candidate.runs) ? candidate.runs : [];
  const runs = rawRuns.map(normalizeExamRun).filter((run) => run !== null) as ExamRun[];
  const migratedFromAppData =
    typeof candidate.migratedFromAppData === "boolean"
      ? candidate.migratedFromAppData
      : false;
  const didMigrate =
    storedVersion !== USER_VAULT_EXAM_RUNS_SCHEMA_VERSION ||
    rawRuns.length !== runs.length ||
    typeof candidate.migratedFromAppData !== "boolean";
  return {
    store: {
      schemaVersion: USER_VAULT_EXAM_RUNS_SCHEMA_VERSION,
      runs,
      migratedFromAppData,
    },
    didMigrate,
  };
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
    settings: {},
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
  const path = resolveProfileMetaPath(profilePath);
  const store = await readJsonFile<UserVaultProfileStore | null>(path, null);
  const fallbackId = resolveProfileIdFromPath(profilePath);
  const migrated = migrateProfileStore(store, fallbackId);
  if (!migrated) {
    return null;
  }
  if (migrated.didMigrate) {
    try {
      await writeJsonFile(path, migrated.store);
    } catch (error) {
      console.warn(
        "Failed to migrate user profile settings",
        asErrorMessage(error, "Unknown error"),
      );
    }
  }
  const settings = migrated.store.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  if (Object.keys(settings).length === 0) {
    return null;
  }
  return settings;
};

export const saveProfileSettings = async (
  profilePath: string,
  settings: UserVaultProfileSettings | null,
): Promise<boolean> => {
  try {
    const path = resolveProfileMetaPath(profilePath);
    const stored = await readJsonFile<Record<string, unknown> | null>(path, null);
    const fallbackId = resolveProfileIdFromPath(profilePath);
    const meta = normalizeProfileMeta(
      fallbackId,
      (stored as UserVaultProfileMeta | null) ?? null,
    );
    const base = stored && typeof stored === "object" ? stored : {};
    await writeJsonFile(path, {
      ...base,
      schemaVersion: USER_VAULT_PROFILE_SCHEMA_VERSION,
      ...meta,
      settings: settings ?? null,
    });
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
  const path = resolveSpacedRepetitionPath(profilePath);
  const store = await readJsonFile<SpacedRepetitionProfileStore>(
    path,
    createEmptySpacedRepetitionStore(),
  );
  return normalizeSpacedRepetitionStore(store);
};

export const saveSpacedRepetitionStore = async (
  profilePath: string,
  store: SpacedRepetitionProfileStore,
) => {
  try {
    await writeJsonFile(resolveSpacedRepetitionPath(profilePath), {
      ...store,
      schemaVersion: USER_VAULT_SCHEMA_VERSION,
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

export const loadExamRunStore = async (
  profilePath: string,
): Promise<ExamRunProfileStore> => {
  const path = resolveExamRunsPath(profilePath);
  const { value, error } = await readJsonFileWithStatus<ExamRunProfileStore>(path);
  if (error) {
    if (error === "parse") {
      const backupPath = buildCorruptBackupPath(path);
      try {
        await renameJsonFile(path, backupPath);
      } catch (renameError) {
        console.warn(
          "Failed to archive corrupt exam run store",
          asErrorMessage(renameError, "Unknown error"),
        );
      }
    }
    const empty = createEmptyExamRunStore();
    try {
      await writeJsonFileAtomic(path, empty);
    } catch (writeError) {
      console.warn(
        "Failed to recover exam run store",
        asErrorMessage(writeError, "Unknown error"),
      );
    }
    return empty;
  }
  const { store, didMigrate } = migrateExamRunStore(value);
  if (didMigrate) {
    try {
      await writeJsonFileAtomic(path, store);
    } catch (writeError) {
      console.warn(
        "Failed to migrate exam run store",
        asErrorMessage(writeError, "Unknown error"),
      );
    }
  }
  return store;
};

export const saveExamRunStore = async (
  profilePath: string,
  store: ExamRunProfileStore,
) => {
  try {
    await writeJsonFileAtomic(resolveExamRunsPath(profilePath), {
      ...store,
      schemaVersion: USER_VAULT_EXAM_RUNS_SCHEMA_VERSION,
    });
  } catch (error) {
    console.error(
      "Failed to save exam run user vault data",
      asErrorMessage(error, "Unknown error"),
    );
  }
};

export const appendExamRunStore = async (
  profilePath: string,
  run: ExamRun,
): Promise<boolean> => {
  const path = resolveExamRunsPath(profilePath);
  try {
    const { value, error } = await readJsonFileWithStatus<ExamRunProfileStore>(
      path,
    );
    let store: ExamRunProfileStore;
    let needsWrite = false;

    if (error) {
      if (error === "parse") {
        const backupPath = buildCorruptBackupPath(path);
        try {
          await renameJsonFile(path, backupPath);
        } catch (renameError) {
          console.warn(
            "Failed to archive corrupt exam run store",
            asErrorMessage(renameError, "Unknown error"),
          );
        }
      }
      store = createEmptyExamRunStore();
      needsWrite = true;
    } else {
      const migrated = migrateExamRunStore(value);
      store = migrated.store;
      needsWrite = migrated.didMigrate;
    }

    if (store.runs.some((entry) => entry.id === run.id)) {
      if (needsWrite) {
        await writeJsonFileAtomic(path, store);
      }
      return true;
    }

    const nextStore: ExamRunProfileStore = {
      ...store,
      schemaVersion: USER_VAULT_EXAM_RUNS_SCHEMA_VERSION,
      runs: [...store.runs, run],
    };
    await writeJsonFileAtomic(path, nextStore);
    return true;
  } catch (error) {
    console.warn(
      "Failed to append exam run store",
      asErrorMessage(error, "Unknown error"),
    );
    return false;
  }
};

export const deleteExamRunStoreEntry = async (
  profilePath: string,
  runId: string,
): Promise<boolean> => {
  const path = resolveExamRunsPath(profilePath);
  try {
    const { value, error } = await readJsonFileWithStatus<ExamRunProfileStore>(path);
    let store: ExamRunProfileStore;
    let needsWrite = false;

    if (error) {
      if (error === "parse") {
        const backupPath = buildCorruptBackupPath(path);
        try {
          await renameJsonFile(path, backupPath);
        } catch (renameError) {
          console.warn(
            "Failed to archive corrupt exam run store",
            asErrorMessage(renameError, "Unknown error"),
          );
        }
      }
      store = createEmptyExamRunStore();
      needsWrite = true;
    } else {
      const migrated = migrateExamRunStore(value);
      store = migrated.store;
      needsWrite = migrated.didMigrate;
    }

    const nextRuns = store.runs.filter((entry) => entry.id !== runId);
    if (!needsWrite && nextRuns.length === store.runs.length) {
      return true;
    }

    const nextStore: ExamRunProfileStore = {
      ...store,
      schemaVersion: USER_VAULT_EXAM_RUNS_SCHEMA_VERSION,
      runs: nextRuns,
    };
    await writeJsonFileAtomic(path, nextStore);
    return true;
  } catch (error) {
    console.warn(
      "Failed to delete exam run store entry",
      asErrorMessage(error, "Unknown error"),
    );
    return false;
  }
};
