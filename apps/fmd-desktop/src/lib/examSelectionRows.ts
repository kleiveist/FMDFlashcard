/**
 * @file apps/fmd-desktop/src/lib/examSelectionRows.ts
 *
 * Zweck:
 * - Hilfsfunktionen fuer die zeilenbasierte Auswahl von Exam-Dateien.
 */

export type ExamSelectionRows = string[][];

export type ExamSelectionPlacementTarget = {
  rowIndex: number;
  slotIndex: number;
};

export const EXAM_SELECTION_ROW_CAPACITY = 3;

const toUniquePaths = (paths: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  paths.forEach((path) => {
    if (!path || seen.has(path)) {
      return;
    }
    seen.add(path);
    next.push(path);
  });
  return next;
};

export const flattenExamSelectionRows = (rows: ExamSelectionRows) =>
  rows.flatMap((row) => row);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeRowCapacity = (
  row: string[],
  maxPerRow: number,
): ExamSelectionRows => {
  if (row.length <= maxPerRow) {
    return [row];
  }
  const chunks: ExamSelectionRows = [];
  for (let index = 0; index < row.length; index += maxPerRow) {
    chunks.push(row.slice(index, index + maxPerRow));
  }
  return chunks;
};

export const normalizeExamSelectionRows = (
  rows: ExamSelectionRows,
  options?: {
    maxPerRow?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  const maxPerRow = Math.max(1, options?.maxPerRow ?? EXAM_SELECTION_ROW_CAPACITY);
  const seen = new Set<string>();
  const next: ExamSelectionRows = [];

  rows.forEach((row) => {
    const normalizedRow = row.filter((path) => {
      if (!path) {
        return false;
      }
      if (options?.validPaths && !options.validPaths.has(path)) {
        return false;
      }
      if (seen.has(path)) {
        return false;
      }
      seen.add(path);
      return true;
    });
    if (normalizedRow.length === 0) {
      return;
    }
    normalizeRowCapacity(normalizedRow, maxPerRow).forEach((chunk) => {
      if (chunk.length > 0) {
        next.push(chunk);
      }
    });
  });

  return next;
};

export const buildExamSelectionRowsFromPaths = (
  paths: string[],
  options?: {
    maxPerRow?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  const maxPerRow = Math.max(1, options?.maxPerRow ?? EXAM_SELECTION_ROW_CAPACITY);
  const normalized = toUniquePaths(paths).filter(
    (path) => !options?.validPaths || options.validPaths.has(path),
  );
  const next: ExamSelectionRows = [];
  for (let index = 0; index < normalized.length; index += maxPerRow) {
    next.push(normalized.slice(index, index + maxPerRow));
  }
  return next;
};

export const toggleExamSelectionPath = (
  rows: ExamSelectionRows,
  path: string,
  options?: {
    maxPerRow?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  if (!path) {
    return normalizeExamSelectionRows(rows, options);
  }
  if (options?.validPaths && !options.validPaths.has(path)) {
    return normalizeExamSelectionRows(rows, options);
  }
  const normalized = normalizeExamSelectionRows(rows, options);
  const existingRowIndex = normalized.findIndex((row) => row.includes(path));
  if (existingRowIndex >= 0) {
    const next = normalized
      .map((row, index) =>
        index === existingRowIndex ? row.filter((entry) => entry !== path) : [...row],
      )
      .filter((row) => row.length > 0);
    return next;
  }
  const maxPerRow = Math.max(1, options?.maxPerRow ?? EXAM_SELECTION_ROW_CAPACITY);
  if (normalized.length === 0) {
    return [[path]];
  }
  const lastRow = normalized[normalized.length - 1];
  if (lastRow && lastRow.length < maxPerRow) {
    return [
      ...normalized.slice(0, -1),
      [...lastRow, path],
    ];
  }
  return [...normalized, [path]];
};

export const locateExamSelectionPath = (
  rows: ExamSelectionRows,
  path: string,
): ExamSelectionPlacementTarget | null => {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const slotIndex = rows[rowIndex]?.indexOf(path) ?? -1;
    if (slotIndex >= 0) {
      return { rowIndex, slotIndex };
    }
  }
  return null;
};

const cloneRows = (rows: ExamSelectionRows) => rows.map((row) => [...row]);

const spillRowOverflow = (
  rows: ExamSelectionRows,
  startRowIndex: number,
  maxPerRow: number,
) => {
  for (let rowIndex = Math.max(0, startRowIndex); rowIndex < rows.length; rowIndex += 1) {
    while ((rows[rowIndex]?.length ?? 0) > maxPerRow) {
      const overflow = rows[rowIndex]?.pop();
      if (!overflow) {
        break;
      }
      if (!rows[rowIndex + 1]) {
        rows[rowIndex + 1] = [];
      }
      rows[rowIndex + 1]?.unshift(overflow);
    }
  }
};

export const placeExamSelectionPath = (
  rows: ExamSelectionRows,
  sourcePath: string,
  target: ExamSelectionPlacementTarget,
  options?: {
    maxPerRow?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  if (!sourcePath) {
    return normalizeExamSelectionRows(rows, options);
  }
  if (options?.validPaths && !options.validPaths.has(sourcePath)) {
    return normalizeExamSelectionRows(rows, options);
  }
  const maxPerRow = Math.max(1, options?.maxPerRow ?? EXAM_SELECTION_ROW_CAPACITY);
  const normalized = cloneRows(normalizeExamSelectionRows(rows, options));
  let removedRowIndex = -1;
  let removedSlotIndex = -1;
  let removedRowDeleted = false;

  for (let rowIndex = 0; rowIndex < normalized.length; rowIndex += 1) {
    const slotIndex = normalized[rowIndex]?.indexOf(sourcePath) ?? -1;
    if (slotIndex < 0) {
      continue;
    }
    normalized[rowIndex]?.splice(slotIndex, 1);
    removedRowIndex = rowIndex;
    removedSlotIndex = slotIndex;
    if ((normalized[rowIndex]?.length ?? 0) === 0) {
      normalized.splice(rowIndex, 1);
      removedRowDeleted = true;
    }
    break;
  }

  let rowIndex = Number.isFinite(target.rowIndex) ? Math.floor(target.rowIndex) : 0;
  if (removedRowDeleted && removedRowIndex >= 0 && removedRowIndex < rowIndex) {
    rowIndex -= 1;
  }
  rowIndex = clamp(rowIndex, 0, normalized.length);
  if (!normalized[rowIndex]) {
    normalized[rowIndex] = [];
  }

  const row = normalized[rowIndex] ?? [];
  let slotIndex = clamp(
    Number.isFinite(target.slotIndex) ? Math.floor(target.slotIndex) : 0,
    0,
    row.length,
  );
  if (!removedRowDeleted && removedRowIndex === rowIndex && removedSlotIndex < slotIndex) {
    slotIndex -= 1;
  }
  row.splice(slotIndex, 0, sourcePath);
  normalized[rowIndex] = row;
  spillRowOverflow(normalized, rowIndex, maxPerRow);

  return normalizeExamSelectionRows(normalized, options);
};

export const moveExamSelectionPathBeforeTarget = (
  rows: ExamSelectionRows,
  sourcePath: string,
  targetPath: string,
  options?: {
    maxPerRow?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  if (!sourcePath || !targetPath || sourcePath === targetPath) {
    return normalizeExamSelectionRows(rows, options);
  }
  const normalized = normalizeExamSelectionRows(rows, options);
  const targetPosition = locateExamSelectionPath(normalized, targetPath);
  if (!targetPosition) {
    return normalized;
  }
  return placeExamSelectionPath(normalized, sourcePath, targetPosition, options);
};

export const areExamSelectionRowsEqual = (
  left: ExamSelectionRows,
  right: ExamSelectionRows,
) => {
  if (left.length !== right.length) {
    return false;
  }
  for (let rowIndex = 0; rowIndex < left.length; rowIndex += 1) {
    const leftRow = left[rowIndex] ?? [];
    const rightRow = right[rowIndex] ?? [];
    if (leftRow.length !== rightRow.length) {
      return false;
    }
    for (let index = 0; index < leftRow.length; index += 1) {
      if (leftRow[index] !== rightRow[index]) {
        return false;
      }
    }
  }
  return true;
};
