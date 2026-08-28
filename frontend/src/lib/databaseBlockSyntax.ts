/**
 * @file frontend/src/lib/databaseBlockSyntax.ts
 *
 * Shared helpers for database block marker detection and line masking.
 */

export const DATABASE_BLOCK_MARKER = "::::";

export const isDatabaseBlockMarkerLine = (line: string) =>
  line.trim() === DATABASE_BLOCK_MARKER;

export const extractDatabaseBlockLineRanges = (lines: string[]) => {
  const ranges: Array<{ startLine: number; endLine: number }> = [];
  let openStartLine: number | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    if (!isDatabaseBlockMarkerLine(line)) {
      continue;
    }
    if (openStartLine === null) {
      openStartLine = lineIndex;
      continue;
    }
    ranges.push({
      startLine: openStartLine,
      endLine: lineIndex,
    });
    openStartLine = null;
  }

  if (openStartLine !== null) {
    ranges.push({
      startLine: openStartLine,
      endLine: Math.max(openStartLine, lines.length - 1),
    });
  }

  return ranges;
};

export const maskDatabaseBlockLines = (lines: string[]) => {
  const masked = [...lines];
  const ranges = extractDatabaseBlockLineRanges(lines);

  for (const range of ranges) {
    for (let lineIndex = range.startLine; lineIndex <= range.endLine; lineIndex += 1) {
      masked[lineIndex] = "";
    }
  }

  return masked;
};
