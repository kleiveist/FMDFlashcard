/**
 * @file apps/fmd-desktop/src/features/exam-editor/fileNaming.ts
 *
 * Zweck:
 * - Helfer fuer neue Exam-Dateinamen.
 */

import { normalizeRelativePath } from "../../lib/path";

const NEW_EXAM_PREFIX = "New Exam";
const MAX_NEW_EXAM_INDEX = 99;

const normalizeDirPath = (value: string) =>
  normalizeRelativePath(value).replace(/\/+$/, "");

const getParentRelativePath = (value: string) => {
  const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return "";
  }
  return normalized.slice(0, lastSlash);
};

const getFileName = (value: string) => {
  const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return normalized;
  }
  return normalized.slice(lastSlash + 1);
};

const buildNewExamFilename = (index: number) =>
  `${NEW_EXAM_PREFIX} ${String(index).padStart(2, "0")}.md`;

export const findNextNewExamFilename = (
  dir: string,
  existingRelativePaths: Iterable<string>,
) => {
  const normalizedDir = normalizeDirPath(dir);
  const existingNames = new Set<string>();

  for (const path of existingRelativePaths) {
    const normalized = normalizeRelativePath(path).replace(/\/+$/, "");
    if (!normalized) {
      continue;
    }
    const parent = getParentRelativePath(normalized);
    if (parent === normalizedDir) {
      existingNames.add(getFileName(normalized));
    }
  }

  for (let index = 1; index <= MAX_NEW_EXAM_INDEX; index += 1) {
    const name = buildNewExamFilename(index);
    if (!existingNames.has(name)) {
      return name;
    }
  }

  return null;
};
