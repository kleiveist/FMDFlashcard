import { tokenizeMarkdownMath } from "./markdownMath";

type MarkdownAstNode = {
  type: string;
  value?: string;
  ordered?: boolean;
  data?: {
    hProperties?: Record<string, unknown>;
  };
  position?: {
    start?: {
      offset?: number;
      line?: number;
      column?: number;
    };
    end?: {
      offset?: number;
      line?: number;
      column?: number;
    };
  };
  children?: MarkdownAstNode[];
};

const normalizeSoftBreaks = (node: MarkdownAstNode) => {
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return;
  }

  const normalizedChildren: MarkdownAstNode[] = [];
  node.children.forEach((child) => {
    normalizeSoftBreaks(child);
    if (child.type !== "text" || typeof child.value !== "string" || !child.value.includes("\n")) {
      normalizedChildren.push(child);
      return;
    }
    const parts = child.value.split("\n");
    parts.forEach((part, index) => {
      if (part.length > 0) {
        normalizedChildren.push({ ...child, value: part });
      }
      if (index < parts.length - 1) {
        normalizedChildren.push({ type: "break" });
      }
    });
  });

  node.children = normalizedChildren;
};

export const remarkPreserveSoftBreaks = () => (tree: MarkdownAstNode) => {
  normalizeSoftBreaks(tree);
};

const resolveOrderedListDelimiterFromLine = (line: string) => {
  const markerMatch = line.match(/^\s*\d+([.)])(?:\s|$)/);
  return markerMatch?.[1] ?? null;
};

const resolveOrderedListDelimiterAtOffset = (source: string, offset?: number) => {
  if (typeof offset !== "number" || offset < 0 || offset >= source.length) {
    return null;
  }
  let lineStart = offset;
  while (lineStart > 0) {
    const previous = source[lineStart - 1];
    if (previous === "\n" || previous === "\r") {
      break;
    }
    lineStart -= 1;
  }
  let lineEnd = offset;
  while (lineEnd < source.length) {
    const current = source[lineEnd];
    if (current === "\n" || current === "\r") {
      break;
    }
    lineEnd += 1;
  }
  return resolveOrderedListDelimiterFromLine(source.slice(lineStart, lineEnd));
};

const resolveOrderedListDelimiterAtLine = (source: string, lineNumber?: number) => {
  if (typeof lineNumber !== "number" || lineNumber < 1) {
    return null;
  }
  const lines = source.split(/\r?\n/);
  const line = lines[lineNumber - 1] ?? "";
  return resolveOrderedListDelimiterFromLine(line);
};

export const resolveOrderedListDelimiter = (
  source: string,
  position?: {
    offset?: number;
    line?: number;
  },
) => {
  const delimiterFromOffset = resolveOrderedListDelimiterAtOffset(source, position?.offset);
  if (delimiterFromOffset) {
    return delimiterFromOffset;
  }
  return resolveOrderedListDelimiterAtLine(source, position?.line);
};

const preserveOrderedListDelimiter = (node: MarkdownAstNode, source: string) => {
  if (node.type === "list" && node.ordered) {
    const firstItem = node.children?.[0];
    const delimiter = resolveOrderedListDelimiter(source, firstItem?.position?.start);
    if (delimiter === ")") {
      const data = node.data ?? {};
      const props = data.hProperties ?? {};
      props["data-md-ordered-delimiter"] = ")";
      data.hProperties = props;
      node.data = data;
    }
  }
  if (!node.children || node.children.length === 0) {
    return;
  }
  node.children.forEach((child) => preserveOrderedListDelimiter(child, source));
};

export const remarkPreserveOrderedListDelimiters = () =>
  (tree: MarkdownAstNode, file: { value?: unknown }) => {
    const source = typeof file.value === "string" ? file.value : "";
    if (!source) {
      return;
    }
    preserveOrderedListDelimiter(tree, source);
  };

const previewInlineCodeSegmentPattern = /(`[^`\n]*`)/g;
const previewFencedCodeDelimiterPattern = /^\s*(```|~~~)/;

const previewInlineFormattingPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<!\\)\*\*\*([^\n*]+?)(?<!\\)\*\*\*/g, "<strong><em>$1</em></strong>"],
  [/(?<!\\)__([^_\n]+?)(?<!\\)__/g, "<u>$1</u>"],
  [/(?<!\\)==([^=\n]+?)(?<!\\)==/g, "<mark class=\"md-inline-highlight\">$1</mark>"],
  [/(?<!\\)\*(?!\*)([^*\n]+?)(?<!\\)\*(?!\*)/g, "<em>$1</em>"],
];

const applyPreviewInlineFormattingToPlainText = (segment: string) => {
  let nextSegment = segment;
  for (const [pattern, replacement] of previewInlineFormattingPatterns) {
    nextSegment = nextSegment.replace(pattern, replacement);
  }
  return nextSegment;
};

const applyPreviewInlineFormattingToSegment = (segment: string) =>
  tokenizeMarkdownMath(segment)
    .map((token) =>
      token.type === "text"
        ? applyPreviewInlineFormattingToPlainText(token.value)
        : token.raw)
    .join("");

export const normalizeInlineFormattingForPreview = (source: string) => {
  if (!source) {
    return source;
  }

  const lines = source.split("\n");
  let inFencedCode = false;
  const transformedLines = lines.map((line) => {
    if (previewFencedCodeDelimiterPattern.test(line)) {
      inFencedCode = !inFencedCode;
      return line;
    }
    if (inFencedCode || line.length === 0) {
      return line;
    }

    const segments = line.split(previewInlineCodeSegmentPattern);
    if (segments.length <= 1) {
      return applyPreviewInlineFormattingToSegment(line);
    }

    return segments
      .map((segment) =>
        segment.startsWith("`") && segment.endsWith("`")
          ? segment
          : applyPreviewInlineFormattingToSegment(segment))
      .join("");
  });

  return transformedLines.join("\n");
};
