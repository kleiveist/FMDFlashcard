/**
 * Exam-specific normalization for leading dot-numbered markers.
 * Removes `n.` prefixes only at line starts (including heading prefixes),
 * while leaving fenced code blocks unchanged.
 */

const fencedCodeDelimiterPattern = /^\s*(```|~~~)/;
const headingDotNumberPattern = /^(\s*#{1,6}\s+)\d+\.\s+(\S.*)$/;
const leadingDotNumberPattern = /^(\s*)\d+\.\s+(\S.*)$/;

const stripDotNumberMarkerFromLine = (line: string) => {
  const headingMatch = line.match(headingDotNumberPattern);
  if (headingMatch) {
    const headingPrefix = headingMatch[1] ?? "";
    const content = headingMatch[2] ?? "";
    return `${headingPrefix}${content}`;
  }

  const listMatch = line.match(leadingDotNumberPattern);
  if (listMatch) {
    const indent = listMatch[1] ?? "";
    const content = listMatch[2] ?? "";
    return `${indent}${content}`;
  }

  return line;
};

export const normalizeExamDotNumberedLines = (lines: string[]) => {
  let inCodeFence = false;
  let activeFenceToken = "";

  return lines.map((line) => {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(fencedCodeDelimiterPattern);
    if (fenceMatch) {
      const token = fenceMatch[1] ?? "";
      if (inCodeFence && token === activeFenceToken) {
        inCodeFence = false;
        activeFenceToken = "";
      } else if (!inCodeFence) {
        inCodeFence = true;
        activeFenceToken = token;
      }
      return line;
    }

    if (inCodeFence) {
      return line;
    }

    return stripDotNumberMarkerFromLine(line);
  });
};
