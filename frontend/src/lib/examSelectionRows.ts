/**
 * @file frontend/src/lib/examSelectionRows.ts
 *
 * Zweck:
 * - Hilfsfunktionen fuer die zeilenbasierte Auswahl von Exam-Dateien.
 */

export type ExamSelectionRows = string[][];

export type ExamSelectionPlacementTarget = {
  rowIndex: number;
  slotIndex: number;
};

export const EXAM_SELECTION_MAX_ROWS = 3;

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

const mergeOverflowRowsIntoLast = (rows: ExamSelectionRows, maxRows: number) => {
  if (rows.length <= maxRows) {
    return rows;
  }
  const stabilized = rows.slice(0, maxRows).map((row) => [...row]);
  const lastIndex = maxRows - 1;
  for (let rowIndex = maxRows; rowIndex < rows.length; rowIndex += 1) {
    stabilized[lastIndex]?.push(...(rows[rowIndex] ?? []));
  }
  return stabilized;
};

export const normalizeExamSelectionRows = (
  rows: ExamSelectionRows,
  options?: {
    maxRows?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  const maxRows = Math.max(1, options?.maxRows ?? EXAM_SELECTION_MAX_ROWS);
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
    next.push(normalizedRow);
  });

  return mergeOverflowRowsIntoLast(next, maxRows);
};

export const buildExamSelectionRowsFromPaths = (
  paths: string[],
  options?: {
    maxRows?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  const maxRows = Math.max(1, options?.maxRows ?? EXAM_SELECTION_MAX_ROWS);
  const normalized = toUniquePaths(paths).filter(
    (path) => !options?.validPaths || options.validPaths.has(path),
  );
  if (normalized.length === 0) {
    return [];
  }
  return mergeOverflowRowsIntoLast([normalized], maxRows);
};

export const toggleExamSelectionPath = (
  rows: ExamSelectionRows,
  path: string,
  options?: {
    maxRows?: number;
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
  if (normalized.length === 0) {
    return [[path]];
  }
  const lastRow = normalized[normalized.length - 1];
  if (lastRow) {
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

export const placeExamSelectionPath = (
  rows: ExamSelectionRows,
  sourcePath: string,
  target: ExamSelectionPlacementTarget,
  options?: {
    maxRows?: number;
    validPaths?: Set<string>;
  },
): ExamSelectionRows => {
  if (!sourcePath) {
    return normalizeExamSelectionRows(rows, options);
  }
  if (options?.validPaths && !options.validPaths.has(sourcePath)) {
    return normalizeExamSelectionRows(rows, options);
  }
  const maxRows = Math.max(1, options?.maxRows ?? EXAM_SELECTION_MAX_ROWS);
  const normalized = cloneRows(normalizeExamSelectionRows(rows, options));
  const targetRowIndexRaw = Number.isFinite(target.rowIndex)
    ? Math.floor(target.rowIndex)
    : 0;
  if (targetRowIndexRaw >= maxRows) {
    return normalized;
  }
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

  let rowIndex = targetRowIndexRaw;
  if (removedRowDeleted && removedRowIndex >= 0 && removedRowIndex < rowIndex) {
    rowIndex -= 1;
  }
  rowIndex = clamp(rowIndex, 0, normalized.length);
  if (!normalized[rowIndex]) {
    normalized[rowIndex] = [];
  }

  const row = normalized[rowIndex] ?? [];
  let slotIndexRaw = Number.isFinite(target.slotIndex) ? Math.floor(target.slotIndex) : 0;
  if (
    !removedRowDeleted &&
    removedRowIndex === rowIndex &&
    removedSlotIndex >= 0 &&
    removedSlotIndex < slotIndexRaw
  ) {
    slotIndexRaw -= 1;
  }
  const slotIndex = clamp(slotIndexRaw, 0, row.length);
  row.splice(slotIndex, 0, sourcePath);
  normalized[rowIndex] = row;

  return normalizeExamSelectionRows(normalized, options);
};

export const moveExamSelectionPathBeforeTarget = (
  rows: ExamSelectionRows,
  sourcePath: string,
  targetPath: string,
  options?: {
    maxRows?: number;
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
