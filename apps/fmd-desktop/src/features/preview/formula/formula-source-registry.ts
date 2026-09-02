/**
 * @file apps/fmd-desktop/src/features/preview/formula/formula-source-registry.ts
 *
 * Shared registry/helpers for formula source options.
 */

import {
  type DatabaseFormulaSourceSpec,
  type DatabaseFormulaSourceType,
} from "./database-formula-types";

export const FORMULA_SOURCE_OPTIONS: DatabaseFormulaSourceType[] = [
  "current-folder",
  "explicit-folder",
  "multi-folder",
  "history",
];

export const FORMULA_SOURCE_LABELS: Record<DatabaseFormulaSourceType, string> = {
  "current-folder": "Aktueller Ordner",
  "explicit-folder": "Ein Ordner",
  "multi-folder": "Mehrere Ordner",
  history: "History",
};

export const FORMULA_HISTORY_DESCRIPTION = "History verwendet die Exam-Runs des aktuellen Vaults.";

export const FORMULA_HISTORY_SOURCE_PREFIX = "Quelle:";

const dedupeCaseInsensitive = (paths: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  paths.forEach((path) => {
    const trimmed = path.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(trimmed);
  });
  return next;
};

export const buildFormulaSourceForType = (
  nextType: DatabaseFormulaSourceType,
  currentSource: DatabaseFormulaSourceSpec,
): DatabaseFormulaSourceSpec => {
  if (nextType === "explicit-folder") {
    return {
      type: nextType,
      path: currentSource.path?.trim() ?? "",
    };
  }
  if (nextType === "multi-folder") {
    return {
      type: nextType,
      paths:
        currentSource.type === "multi-folder"
          ? dedupeCaseInsensitive(currentSource.paths ?? [])
          : [],
    };
  }
  return {
    type: nextType,
  };
};

export const normalizeFormulaSourceForPersist = (
  source: DatabaseFormulaSourceSpec,
): DatabaseFormulaSourceSpec => {
  if (source.type === "explicit-folder") {
    return {
      type: "explicit-folder",
      path: source.path?.trim() ?? "",
    };
  }

  if (source.type === "multi-folder") {
    return {
      type: "multi-folder",
      paths: dedupeCaseInsensitive(source.paths ?? []),
    };
  }

  return {
    type: source.type,
  };
};
