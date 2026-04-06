import { compareNaturalPath, compareNaturalText } from "../../lib/naturalSort";
import { normalizeRelativePath } from "../../lib/path";
import type {
  Flashcard,
  FlashcardDetectedType,
  FlashcardPart,
  FlashcardSourceRange,
  ParsedFlashcardEntry,
} from "../../lib/flashcards";

export type CardMonitoringSortBy =
  | "file-name"
  | "folder-path"
  | "cards-per-file"
  | "card-order";

export type CardMonitoringSortDirection = "asc" | "desc";

export type CardMonitoringFilterState = {
  folderPath: string;
  filePath: string;
  cardType: FlashcardDetectedType | "all";
  query: string;
};

export type CardMonitoringSortState = {
  sortBy: CardMonitoringSortBy;
  direction: CardMonitoringSortDirection;
};

export type CardMonitoringScannedFile = {
  sourcePath: string;
  relativePath: string;
  parsedEntries: ParsedFlashcardEntry[];
};

export type CardMonitoringEntry = {
  id: string;
  sourcePath: string;
  relativePath: string;
  folderPath: string;
  fileName: string;
  sourceRange: FlashcardSourceRange;
  cardIndexInFile: number;
  fileCardCount: number;
  cardType: FlashcardDetectedType;
  prompt: string;
};

export type CardMonitoringFileGroup = {
  sourcePath: string;
  relativePath: string;
  folderPath: string;
  fileName: string;
  fileCardCount: number;
  entries: CardMonitoringEntry[];
};

export type CardMonitoringFolderGroup = {
  folderPath: string;
  displayName: string;
  cardCount: number;
  fileCount: number;
  files: CardMonitoringFileGroup[];
};

export type CardMonitoringStagedScope = {
  id: string;
  sourcePath: string;
  sourceRange: FlashcardSourceRange;
};

export type CardMonitoringSavePlanFile = {
  sourcePath: string;
  ranges: FlashcardSourceRange[];
  entryIds: string[];
};

export type CardMonitoringRemoveResult = {
  nextContents: string;
  changed: boolean;
  removedCount: number;
  skippedCount: number;
};

const CARD_START_PATTERN = /^\s*#card\s*$/i;
const CARD_END_PATTERN = /^\s*#endcard\s*$/i;

const normalizePromptText = (value: string) => value.replace(/\s+/g, " ").trim();

const truncatePrompt = (value: string, maxLength = 160) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const resolvePromptFromPart = (part: FlashcardPart): string => {
  if (part.kind === "free-text") {
    return normalizePromptText(part.front);
  }
  if (part.kind === "multiple-choice") {
    return normalizePromptText(part.question || part.context || "");
  }
  if (part.kind === "true-false") {
    return normalizePromptText(part.context || part.items[0]?.question || "");
  }
  return normalizePromptText(part.question);
};

const resolvePartType = (part: FlashcardPart): FlashcardDetectedType => {
  if (part.kind === "free-text") {
    return "qa";
  }
  if (part.kind === "multiple-choice") {
    return "multiple-choice";
  }
  if (part.kind === "true-false") {
    return "true-false";
  }
  if (part.subtype === "cd") {
    return "assignment";
  }
  if (part.subtype === "cld") {
    return part.dragTokens.length > 0 ? "assignment" : "fill-blank";
  }
  return "fill-blank";
};

const resolveCardType = (card: Flashcard): FlashcardDetectedType => {
  if (card.primaryType) {
    return card.primaryType;
  }
  if (card.detectedTypes && card.detectedTypes.length > 0) {
    return card.detectedTypes[0];
  }
  if (card.kind === "composite") {
    return card.parts.length > 0 ? resolvePartType(card.parts[0]) : "qa";
  }
  return resolvePartType(card);
};

export const resolveCardMonitoringPrompt = (card: Flashcard) => {
  if (card.kind === "composite") {
    const firstPart = card.parts[0];
    const prompt = firstPart ? resolvePromptFromPart(firstPart) : "";
    return truncatePrompt(prompt || "(No prompt)");
  }
  return truncatePrompt(resolvePromptFromPart(card) || "(No prompt)");
};

const extractFolderPath = (relativePath: string) => {
  const lastSlash = relativePath.lastIndexOf("/");
  if (lastSlash < 0) {
    return "";
  }
  return relativePath.slice(0, lastSlash);
};

const extractFileName = (relativePath: string) => {
  const lastSlash = relativePath.lastIndexOf("/");
  if (lastSlash < 0) {
    return relativePath;
  }
  return relativePath.slice(lastSlash + 1);
};

export const buildCardMonitoringEntries = (
  scannedFiles: CardMonitoringScannedFile[],
): CardMonitoringEntry[] =>
  scannedFiles.flatMap((fileScan) => {
    const relativePath = normalizeRelativePath(fileScan.relativePath);
    const folderPath = extractFolderPath(relativePath);
    const fileName = extractFileName(relativePath);
    const fileCardCount = fileScan.parsedEntries.length;

    return fileScan.parsedEntries.map((entry, index) => ({
      id: `${fileScan.sourcePath}:${entry.sourceRange.startLine}:${entry.sourceRange.endLine}`,
      sourcePath: fileScan.sourcePath,
      relativePath,
      folderPath,
      fileName,
      sourceRange: {
        startLine: entry.sourceRange.startLine,
        endLine: entry.sourceRange.endLine,
      },
      cardIndexInFile: index + 1,
      fileCardCount,
      cardType: resolveCardType(entry.card),
      prompt: resolveCardMonitoringPrompt(entry.card),
    }));
  });

const compareNumbers = (left: number, right: number) => left - right;

const applySortDirection = (
  value: number,
  direction: CardMonitoringSortDirection,
) => (direction === "asc" ? value : -value);

const compareCardMonitoringEntries = (
  left: CardMonitoringEntry,
  right: CardMonitoringEntry,
  sortBy: CardMonitoringSortBy,
) => {
  if (sortBy === "file-name") {
    return (
      compareNaturalText(left.fileName, right.fileName) ||
      compareNaturalPath(left.relativePath, right.relativePath) ||
      compareNumbers(left.cardIndexInFile, right.cardIndexInFile)
    );
  }
  if (sortBy === "folder-path") {
    return (
      compareNaturalPath(left.folderPath, right.folderPath) ||
      compareNaturalText(left.fileName, right.fileName) ||
      compareNumbers(left.cardIndexInFile, right.cardIndexInFile)
    );
  }
  if (sortBy === "cards-per-file") {
    return (
      compareNumbers(left.fileCardCount, right.fileCardCount) ||
      compareNaturalPath(left.relativePath, right.relativePath) ||
      compareNumbers(left.cardIndexInFile, right.cardIndexInFile)
    );
  }
  return (
    compareNaturalPath(left.relativePath, right.relativePath) ||
    compareNumbers(left.cardIndexInFile, right.cardIndexInFile)
  );
};

export const sortCardMonitoringEntries = (
  entries: CardMonitoringEntry[],
  sortState: CardMonitoringSortState,
) =>
  [...entries].sort((left, right) =>
    applySortDirection(
      compareCardMonitoringEntries(left, right, sortState.sortBy),
      sortState.direction,
    ),
  );

export const filterCardMonitoringEntries = (
  entries: CardMonitoringEntry[],
  filters: CardMonitoringFilterState,
) => {
  const normalizedQuery = filters.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.folderPath && entry.folderPath !== filters.folderPath) {
      return false;
    }
    if (filters.filePath && entry.relativePath !== filters.filePath) {
      return false;
    }
    if (filters.cardType !== "all" && entry.cardType !== filters.cardType) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      entry.prompt.toLowerCase().includes(normalizedQuery) ||
      entry.relativePath.toLowerCase().includes(normalizedQuery) ||
      entry.folderPath.toLowerCase().includes(normalizedQuery) ||
      entry.fileName.toLowerCase().includes(normalizedQuery)
    );
  });
};

const compareFileGroups = (
  left: CardMonitoringFileGroup,
  right: CardMonitoringFileGroup,
  sortBy: CardMonitoringSortBy,
  direction: CardMonitoringSortDirection,
) => {
  const baseCompare =
    sortBy === "file-name"
      ? compareNaturalText(left.fileName, right.fileName)
      : sortBy === "cards-per-file"
        ? compareNumbers(left.fileCardCount, right.fileCardCount) ||
          compareNaturalText(left.fileName, right.fileName)
        : compareNaturalText(left.fileName, right.fileName);

  return applySortDirection(baseCompare, direction);
};

const sortEntriesForFile = (
  entries: CardMonitoringEntry[],
  sortState: CardMonitoringSortState,
) => {
  const direction =
    sortState.sortBy === "card-order" ? sortState.direction : "asc";
  return [...entries].sort((left, right) =>
    applySortDirection(
      compareNumbers(left.cardIndexInFile, right.cardIndexInFile),
      direction,
    ),
  );
};

export const buildCardMonitoringGroups = (
  entries: CardMonitoringEntry[],
  sortState: CardMonitoringSortState,
): CardMonitoringFolderGroup[] => {
  const fileMap = new Map<string, CardMonitoringFileGroup>();

  entries.forEach((entry) => {
    const existing = fileMap.get(entry.sourcePath);
    if (existing) {
      existing.entries.push(entry);
      return;
    }
    fileMap.set(entry.sourcePath, {
      sourcePath: entry.sourcePath,
      relativePath: entry.relativePath,
      folderPath: entry.folderPath,
      fileName: entry.fileName,
      fileCardCount: entry.fileCardCount,
      entries: [entry],
    });
  });

  const fileGroups = Array.from(fileMap.values()).map((group) => ({
    ...group,
    entries: sortEntriesForFile(group.entries, sortState),
  }));

  const folderMap = new Map<string, CardMonitoringFileGroup[]>();
  fileGroups.forEach((group) => {
    const current = folderMap.get(group.folderPath) ?? [];
    current.push(group);
    folderMap.set(group.folderPath, current);
  });

  const folderPaths = Array.from(folderMap.keys()).sort((left, right) => {
    const compare = compareNaturalPath(left, right);
    if (sortState.sortBy !== "folder-path") {
      return compare;
    }
    return applySortDirection(compare, sortState.direction);
  });

  return folderPaths.map((folderPath) => {
    const files = (folderMap.get(folderPath) ?? []).sort((left, right) =>
      compareFileGroups(left, right, sortState.sortBy, sortState.direction),
    );
    const cardCount = files.reduce((sum, file) => sum + file.entries.length, 0);
    return {
      folderPath,
      displayName: folderPath || "(Vault root)",
      cardCount,
      fileCount: files.length,
      files,
    };
  });
};

export const buildCardMonitoringSavePlan = (
  stagedScopes: CardMonitoringStagedScope[],
): CardMonitoringSavePlanFile[] => {
  const grouped = new Map<string, { ranges: FlashcardSourceRange[]; entryIds: string[] }>();

  stagedScopes.forEach((scope) => {
    const current = grouped.get(scope.sourcePath) ?? { ranges: [], entryIds: [] };
    const exists = current.ranges.some(
      (range) =>
        range.startLine === scope.sourceRange.startLine &&
        range.endLine === scope.sourceRange.endLine,
    );
    if (!exists) {
      current.ranges.push({
        startLine: scope.sourceRange.startLine,
        endLine: scope.sourceRange.endLine,
      });
    }
    current.entryIds.push(scope.id);
    grouped.set(scope.sourcePath, current);
  });

  return Array.from(grouped.entries())
    .sort((left, right) => compareNaturalPath(left[0], right[0]))
    .map(([sourcePath, payload]) => ({
      sourcePath,
      ranges: [...payload.ranges].sort(
        (left, right) =>
          right.startLine - left.startLine || right.endLine - left.endLine,
      ),
      entryIds: payload.entryIds,
    }));
};

export const applyCardWrapperRemovals = (
  contents: string,
  ranges: FlashcardSourceRange[],
): CardMonitoringRemoveResult => {
  const lines = contents.replace(/\r\n?/g, "\n").split("\n");
  const sortedRanges = [...ranges].sort(
    (left, right) => right.startLine - left.startLine || right.endLine - left.endLine,
  );

  let removedCount = 0;
  let skippedCount = 0;

  sortedRanges.forEach((range) => {
    const startLine = Math.max(0, Math.min(range.startLine, lines.length - 1));
    const endLine = Math.max(startLine, Math.min(range.endLine, lines.length - 1));
    const startLineContent = lines[startLine] ?? "";
    const endLineContent = lines[endLine] ?? "";

    if (!CARD_START_PATTERN.test(startLineContent) || !CARD_END_PATTERN.test(endLineContent)) {
      skippedCount += 1;
      return;
    }

    lines.splice(endLine, 1);
    lines.splice(startLine, 1);
    removedCount += 1;
  });

  return {
    nextContents: lines.join("\n"),
    changed: removedCount > 0,
    removedCount,
    skippedCount,
  };
};
