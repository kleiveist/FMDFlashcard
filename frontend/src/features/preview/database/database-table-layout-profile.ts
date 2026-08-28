/**
 * @file frontend/src/features/preview/database/database-table-layout-profile.ts
 *
 * Persists database table layout preferences in the vault profile area.
 */

import { invoke } from "@tauri-apps/api/core";
import { joinPath, normalizeRelativePath } from "../../../lib/path";

export type DatabaseTableLayoutProfile = {
  columnOrder: string[];
  columnWidths: Record<string, number>;
};

type DatabaseTableLayoutProfileStore = {
  schemaVersion: number;
  layouts: Record<string, DatabaseTableLayoutProfile>;
};

type DatabaseTableLayoutProfileIo = {
  readJsonFile: (path: string) => Promise<string>;
  writeJsonFile: (path: string, contents: string) => Promise<void>;
};

const TABLE_LAYOUT_SCHEMA_VERSION = 1;
const TABLE_LAYOUT_FILE = "table-view-layouts.json";
const TABLE_LAYOUT_DIR = "database-layouts";
const PROFILE_ROOT_DIR = ".profile";
const MIN_TABLE_COLUMN_WIDTH = 96;
const MAX_TABLE_COLUMN_WIDTH = 640;

const defaultIo: DatabaseTableLayoutProfileIo = {
  readJsonFile: (path) => invoke<string>("read_json_file", { path }),
  writeJsonFile: (path, contents) => invoke<void>("write_json_file", { path, contents }),
};

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const normalizeColumnOrder = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .map((entry) => typeof entry === "string" ? entry.trim() : "")
      .filter(Boolean)
      .filter((entry, index, entries) =>
        entries.findIndex((candidate) => candidate.toLowerCase() === entry.toLowerCase()) === index)
    : [];

const normalizeColumnWidths = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((next, [key, width]) => {
    const normalizedKey = key.trim();
    const numeric = typeof width === "number" ? width : Number(width);
    if (!normalizedKey || !Number.isFinite(numeric)) {
      return next;
    }
    next[normalizedKey] = Math.min(
      MAX_TABLE_COLUMN_WIDTH,
      Math.max(MIN_TABLE_COLUMN_WIDTH, Math.round(numeric)),
    );
    return next;
  }, {});
};

export const normalizeDatabaseTableLayoutProfile = (
  value: unknown,
): DatabaseTableLayoutProfile => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      columnOrder: [],
      columnWidths: {},
    };
  }
  const candidate = value as {
    columnOrder?: unknown;
    columnWidths?: unknown;
  };
  return {
    columnOrder: normalizeColumnOrder(candidate.columnOrder),
    columnWidths: normalizeColumnWidths(candidate.columnWidths),
  };
};

const normalizeStore = (value: unknown): DatabaseTableLayoutProfileStore => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      schemaVersion: TABLE_LAYOUT_SCHEMA_VERSION,
      layouts: {},
    };
  }
  const candidate = value as { layouts?: unknown };
  const layouts = candidate.layouts && typeof candidate.layouts === "object" && !Array.isArray(candidate.layouts)
    ? Object.entries(candidate.layouts as Record<string, unknown>).reduce<Record<string, DatabaseTableLayoutProfile>>(
      (next, [key, layout]) => {
        const normalizedKey = key.trim();
        if (!normalizedKey) {
          return next;
        }
        next[normalizedKey] = normalizeDatabaseTableLayoutProfile(layout);
        return next;
      },
      {},
    )
    : {};
  return {
    schemaVersion: TABLE_LAYOUT_SCHEMA_VERSION,
    layouts,
  };
};

export const resolveDatabaseTableLayoutProfilePath = (vaultPath: string) =>
  joinPath(vaultPath, PROFILE_ROOT_DIR, TABLE_LAYOUT_DIR, TABLE_LAYOUT_FILE);

export const buildDatabaseTableLayoutKey = ({
  sourceRelativePath,
  blockIndex,
  viewId,
}: {
  sourceRelativePath?: string | null;
  blockIndex?: number | null;
  viewId: string;
}) => {
  const source = normalizeRelativePath(sourceRelativePath ?? "__unknown__") || "__unknown__";
  const block = Number.isInteger(blockIndex) && (blockIndex ?? -1) >= 0
    ? String(blockIndex)
    : "__unknown__";
  return hashText(`${source}\n${block}\n${viewId.trim() || "__default__"}`);
};

export const applyDatabaseTableLayoutOrder = <T extends { key: string }>(
  columns: T[],
  layout: DatabaseTableLayoutProfile | null,
): T[] => {
  const order = layout?.columnOrder ?? [];
  if (order.length === 0) {
    return columns;
  }
  const columnByKey = new Map(columns.map((column) => [column.key.toLowerCase(), column]));
  const ordered: T[] = [];
  order.forEach((key) => {
    const column = columnByKey.get(key.toLowerCase());
    if (column && !ordered.some((entry) => entry.key.toLowerCase() === column.key.toLowerCase())) {
      ordered.push(column);
    }
  });
  columns.forEach((column) => {
    if (!ordered.some((entry) => entry.key.toLowerCase() === column.key.toLowerCase())) {
      ordered.push(column);
    }
  });
  return ordered;
};

export const readDatabaseTableLayoutProfile = async (
  vaultPath: string | null | undefined,
  layoutKey: string,
  io: DatabaseTableLayoutProfileIo = defaultIo,
): Promise<DatabaseTableLayoutProfile | null> => {
  if (!vaultPath || !layoutKey.trim()) {
    return null;
  }
  try {
    const raw = await io.readJsonFile(resolveDatabaseTableLayoutProfilePath(vaultPath));
    const store = normalizeStore(JSON.parse(raw));
    return store.layouts[layoutKey] ?? null;
  } catch {
    return null;
  }
};

export const writeDatabaseTableLayoutProfile = async (
  vaultPath: string | null | undefined,
  layoutKey: string,
  layout: DatabaseTableLayoutProfile,
  io: DatabaseTableLayoutProfileIo = defaultIo,
) => {
  if (!vaultPath || !layoutKey.trim()) {
    return;
  }
  const path = resolveDatabaseTableLayoutProfilePath(vaultPath);
  let store = normalizeStore(null);
  try {
    const raw = await io.readJsonFile(path);
    store = normalizeStore(JSON.parse(raw));
  } catch {
    store = normalizeStore(null);
  }
  store.layouts[layoutKey] = normalizeDatabaseTableLayoutProfile(layout);
  await io.writeJsonFile(path, JSON.stringify(store, null, 2));
};
