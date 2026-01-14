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
  USER_VAULT_SCHEMA_VERSION,
  buildProfileId,
  buildUserVaultProfilePath,
  parseProfileId,
  sanitizeProfileName,
  type UserVaultProfileData,
  type UserVaultProfileMeta,
} from "../../lib/userVault";
import type { FastFlashcardSessionSummary } from "../../lib/fastFlashcard";
import type { ExamRun } from "../../lib/examRuns";
import type { SpacedRepetitionStorage } from "../spaced-repetition/logic";

type PathInfo = {
  exists: boolean;
  isDir: boolean;
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
const USER_VAULT_PROFILE_FILE = "profile.json";
const USER_VAULT_SPACED_REPETITION_FILE = "spaced-repetition.json";
const USER_VAULT_FAST_FLASHCARD_FILE = "fast-flashcard.json";
const USER_VAULT_EXAM_RUNS_FILE = "exam-runs.json";

const readJsonFile = async <T,>(path: string, fallback: T): Promise<T> => {
  try {
    const raw = await invoke<string>("read_json_file", { path });
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJsonFile = async (path: string, payload: unknown) => {
  const contents = JSON.stringify(payload, null, 2);
  await invoke("write_json_file", { path, contents });
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

const resolveProfilesRootPath = (userVaultPath: string) =>
  joinPath(userVaultPath, USER_VAULT_PROFILES_DIR);

const resolveProfileMetaPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_PROFILE_FILE);

const resolveSpacedRepetitionPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_SPACED_REPETITION_FILE);

const resolveFastFlashcardPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_FAST_FLASHCARD_FILE);

const resolveExamRunsPath = (profilePath: string) =>
  joinPath(profilePath, USER_VAULT_EXAM_RUNS_FILE);

const createEmptyUserVaultMeta = (): UserVaultMetaStore => ({
  schemaVersion: USER_VAULT_SCHEMA_VERSION,
  activeProfileId: null,
});

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
  schemaVersion: USER_VAULT_SCHEMA_VERSION,
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

const normalizeExamRunStore = (value: unknown): ExamRunProfileStore => {
  if (!value || typeof value !== "object") {
    return createEmptyExamRunStore();
  }
  const candidate = value as Partial<ExamRunProfileStore>;
  const runs = Array.isArray(candidate.runs) ? (candidate.runs as ExamRun[]) : [];
  const migratedFromAppData =
    typeof candidate.migratedFromAppData === "boolean"
      ? candidate.migratedFromAppData
      : false;
  return {
    schemaVersion: USER_VAULT_SCHEMA_VERSION,
    runs,
    migratedFromAppData,
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

export const listUserVaultProfiles = async (
  userVaultPath: string,
): Promise<UserVaultProfileSummary[]> => {
  const profilesRoot = resolveProfilesRootPath(userVaultPath);
  const entries = await listDirectories(profilesRoot);
  const profiles = await Promise.all(
    entries.map(async (profileId) => {
      const profilePath = buildUserVaultProfilePath(userVaultPath, profileId);
      const metaPath = resolveProfileMetaPath(profilePath);
      const meta = await readJsonFile<UserVaultProfileMeta | null>(metaPath, null);
      return { ...normalizeProfileMeta(profileId, meta), path: profilePath };
    }),
  );
  return profiles.sort((a, b) => a.id.localeCompare(b.id));
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
  const profilesRoot = resolveProfilesRootPath(userVaultPath);
  await ensureDirectory(profilesRoot);
  let candidate = baseId;
  let suffix = 1;
  while (true) {
    const profilePath = buildUserVaultProfilePath(userVaultPath, candidate);
    const info = await invoke<PathInfo>("get_path_info", { path: profilePath });
    if (!info.exists) {
      break;
    }
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  const profilePath = buildUserVaultProfilePath(userVaultPath, candidate);
  await ensureDirectory(profilePath);
  const meta: UserVaultProfileMeta = {
    id: candidate,
    name: sanitized,
    createdAt: new Date().toISOString(),
  };
  await writeJsonFile(resolveProfileMetaPath(profilePath), meta);
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
  return {
    spacedRepetitionByVaultId: spacedRepetition.byVaultId,
    fastFlashcardSessions: fastFlashcard.sessions,
    examRuns: examRuns.runs,
  };
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
  const store = await readJsonFile<ExamRunProfileStore>(
    path,
    createEmptyExamRunStore(),
  );
  return normalizeExamRunStore(store);
};

export const saveExamRunStore = async (
  profilePath: string,
  store: ExamRunProfileStore,
) => {
  try {
    await writeJsonFile(resolveExamRunsPath(profilePath), {
      ...store,
      schemaVersion: USER_VAULT_SCHEMA_VERSION,
    });
  } catch (error) {
    console.error(
      "Failed to save exam run user vault data",
      asErrorMessage(error, "Unknown error"),
    );
  }
};
