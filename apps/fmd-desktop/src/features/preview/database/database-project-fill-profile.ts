/**
 * @file apps/fmd-desktop/src/features/preview/database/database-project-fill-profile.ts
 *
 * Persists Project view progress fill rules in the vault profile area.
 */

import { invoke } from "@tauri-apps/api/core";
import { joinPath } from "../../../lib/path";
import {
  type DatabaseProjectBarFillConfig,
  type DatabaseProjectBarFillMapping,
  type DatabaseProjectBarFillMode,
} from "./database-types";

export type DatabaseProjectFillProfile = {
  barFillConfigs: DatabaseProjectBarFillConfig[];
};

type DatabaseProjectFillProfileStore = {
  schemaVersion: number;
  profiles: Record<string, DatabaseProjectFillProfile>;
};

type DatabaseProjectFillProfileIo = {
  readJsonFile: (path: string) => Promise<string>;
  writeJsonFile: (path: string, contents: string) => Promise<void>;
};

const PROJECT_FILL_SCHEMA_VERSION = 1;
const PROJECT_FILL_FILE = "project-view-fill-rules.json";
const DATABASE_LAYOUT_DIR = "database-layouts";
const PROFILE_ROOT_DIR = ".profile";

const defaultIo: DatabaseProjectFillProfileIo = {
  readJsonFile: (path) => invoke<string>("read_json_file", { path }),
  writeJsonFile: (path, contents) => invoke<void>("write_json_file", { path, contents }),
};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeProjectBarFillMode = (value: unknown): DatabaseProjectBarFillMode =>
  value === "text-code" ? "text-code" : "numeric";

export const normalizeProjectBarFillMappings = (
  mappings: unknown,
): DatabaseProjectBarFillMapping[] =>
  (Array.isArray(mappings) ? mappings : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const candidate = entry as { from?: unknown; to?: unknown };
      const from = asString(candidate.from);
      const to = asFiniteNumber(candidate.to);
      if (!from || to === null) {
        return null;
      }
      return {
        from,
        to,
      };
    })
    .filter((entry): entry is DatabaseProjectBarFillMapping => Boolean(entry));

export const cloneProjectBarFillConfigs = (
  configs: DatabaseProjectBarFillConfig[] | undefined,
): DatabaseProjectBarFillConfig[] =>
  (configs ?? []).map((entry) => ({
    ...entry,
    mappings: (entry.mappings ?? []).map((mapping) => ({ ...mapping })),
  }));

export const normalizeProjectBarFillConfigs = (
  configs: unknown,
): DatabaseProjectBarFillConfig[] => {
  const byRecordId = new Map<string, DatabaseProjectBarFillConfig>();
  (Array.isArray(configs) ? configs : []).forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    const candidate = entry as {
      recordId?: unknown;
      attributeKey?: unknown;
      mode?: unknown;
      min?: unknown;
      max?: unknown;
      mappings?: unknown;
    };
    const recordId = asString(candidate.recordId);
    const attributeKey = asString(candidate.attributeKey);
    if (!recordId || !attributeKey) {
      return;
    }
    const mode = normalizeProjectBarFillMode(candidate.mode);
    if (mode === "text-code") {
      byRecordId.set(recordId, {
        recordId,
        attributeKey,
        mode,
        mappings: normalizeProjectBarFillMappings(candidate.mappings),
      });
      return;
    }
    const min = asFiniteNumber(candidate.min);
    const max = asFiniteNumber(candidate.max);
    const hasValidRange = min !== null && max !== null && max > min;
    byRecordId.set(recordId, {
      recordId,
      attributeKey,
      mode,
      ...(hasValidRange ? { min, max } : {}),
    });
  });
  return Array.from(byRecordId.values());
};

export const normalizeDatabaseProjectFillProfile = (value: unknown): DatabaseProjectFillProfile => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      barFillConfigs: [],
    };
  }
  const candidate = value as { barFillConfigs?: unknown };
  return {
    barFillConfigs: normalizeProjectBarFillConfigs(candidate.barFillConfigs),
  };
};

const normalizeStore = (value: unknown): DatabaseProjectFillProfileStore => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      schemaVersion: PROJECT_FILL_SCHEMA_VERSION,
      profiles: {},
    };
  }
  const candidate = value as { profiles?: unknown };
  const profiles =
    candidate.profiles &&
    typeof candidate.profiles === "object" &&
    !Array.isArray(candidate.profiles)
      ? Object.entries(candidate.profiles as Record<string, unknown>).reduce<
          Record<string, DatabaseProjectFillProfile>
        >((next, [key, profile]) => {
          const normalizedKey = key.trim();
          if (!normalizedKey) {
            return next;
          }
          next[normalizedKey] = normalizeDatabaseProjectFillProfile(profile);
          return next;
        }, {})
      : {};
  return {
    schemaVersion: PROJECT_FILL_SCHEMA_VERSION,
    profiles,
  };
};

const cloneProjectBarFillConfigForRecord = (
  template: DatabaseProjectBarFillConfig,
  recordId: string,
): DatabaseProjectBarFillConfig => ({
  recordId,
  attributeKey: template.attributeKey,
  mode: template.mode,
  ...(template.mode === "text-code"
    ? {
        mappings: (template.mappings ?? []).map((mapping) => ({ ...mapping })),
      }
    : {
        ...(typeof template.min === "number" ? { min: template.min } : {}),
        ...(typeof template.max === "number" ? { max: template.max } : {}),
      }),
});

export const applyProjectBarFillConfigToRecordIds = (
  currentConfigs: DatabaseProjectBarFillConfig[],
  template: DatabaseProjectBarFillConfig,
  recordIds: string[],
): DatabaseProjectBarFillConfig[] => {
  const targetIds = new Set(recordIds);
  return normalizeProjectBarFillConfigs([
    ...cloneProjectBarFillConfigs(currentConfigs).filter((entry) => !targetIds.has(entry.recordId)),
    ...recordIds.map((recordId) => cloneProjectBarFillConfigForRecord(template, recordId)),
  ]);
};

export const resolveDatabaseProjectFillProfilePath = (vaultPath: string) =>
  joinPath(vaultPath, PROFILE_ROOT_DIR, DATABASE_LAYOUT_DIR, PROJECT_FILL_FILE);

export const readDatabaseProjectFillProfile = async (
  vaultPath: string | null | undefined,
  profileKey: string,
  io: DatabaseProjectFillProfileIo = defaultIo,
): Promise<DatabaseProjectFillProfile | null> => {
  if (!vaultPath || !profileKey.trim()) {
    return null;
  }
  try {
    const raw = await io.readJsonFile(resolveDatabaseProjectFillProfilePath(vaultPath));
    const store = normalizeStore(JSON.parse(raw));
    return store.profiles[profileKey] ?? null;
  } catch {
    return null;
  }
};

export const writeDatabaseProjectFillProfile = async (
  vaultPath: string | null | undefined,
  profileKey: string,
  profile: DatabaseProjectFillProfile,
  io: DatabaseProjectFillProfileIo = defaultIo,
) => {
  if (!vaultPath || !profileKey.trim()) {
    return;
  }
  const path = resolveDatabaseProjectFillProfilePath(vaultPath);
  let store = normalizeStore(null);
  try {
    const raw = await io.readJsonFile(path);
    store = normalizeStore(JSON.parse(raw));
  } catch {
    store = normalizeStore(null);
  }
  store.profiles[profileKey] = normalizeDatabaseProjectFillProfile(profile);
  await io.writeJsonFile(path, JSON.stringify(store, null, 2));
};
