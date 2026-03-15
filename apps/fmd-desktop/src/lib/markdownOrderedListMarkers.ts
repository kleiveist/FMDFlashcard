/**
 * Keeps dot-delimited numeric markers (`1. `) as plain text in markdown render paths.
 * Escapes only leading markers and ignores fenced code blocks.
 */
const fencedCodeDelimiterPattern = /^\s*(```|~~~)/;

export const escapeDotOrderedListMarkers = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }
  const lines = markdown.split("\n");
  let inCodeFence = false;
  let fenceToken = "";

  return lines
    .map((line) => {
      const trimmed = line.trimStart();
      const fenceMatch = trimmed.match(fencedCodeDelimiterPattern);
      if (fenceMatch) {
        const token = fenceMatch[1] ?? "";
        if (inCodeFence && token === fenceToken) {
          inCodeFence = false;
          fenceToken = "";
        } else if (!inCodeFence) {
          inCodeFence = true;
          fenceToken = token;
        }
        return line;
      }
      if (inCodeFence) {
        return line;
      }
      return line.replace(/^(\s*\d+)\.(\s+)/, "$1\\.$2");
    })
    .join("\n");
};
