/**
 * @file apps/fmd-desktop/src/components/PreviewPanel.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Preview Panel.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/types.ts: Typen.
 * - apps/fmd-desktop/src/lib/tree.ts: Typen.
 *
 * Exportiert:
 * - PreviewPanel: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  type FocusEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

type PreviewPanelProps = {
  editDraft: string;
  editError: string;
  editCaretIndex: number | null;
  isEditing: boolean;
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  rawPreview: boolean;
  selectedFile: VaultFile | null;
  canEdit: boolean;
  onEditChange: (value: string) => void;
  onEditCaretApplied: () => void;
  onEditExit: () => void;
  onEditStart: (options?: {
    caretIndex?: number | null;
    origin?: "raw" | "markdown";
  }) => void;
  onToggleRawPreview: () => void;
};

const getRangeOffset = (container: HTMLElement, range: Range) => {
  const offsetRange = document.createRange();
  offsetRange.setStart(container, 0);
  offsetRange.setEnd(range.startContainer, range.startOffset);
  return offsetRange.toString().length;
};

const getSelectionRange = (container: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) {
    return null;
  }
  return range;
};

const getRangeFromPoint = (x: number, y: number) => {
  if ("caretRangeFromPoint" in document) {
    return (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
      .caretRangeFromPoint?.(x, y) ?? null;
  }
  if ("caretPositionFromPoint" in document) {
    const position = (
      document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint?.(x, y);
    if (position) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
};

const getRangeFromEvent = (
  event: MouseEvent<HTMLDivElement>,
  container: HTMLElement,
) => {
  const rangeFromPoint = getRangeFromPoint(event.clientX, event.clientY);
  if (rangeFromPoint && container.contains(rangeFromPoint.startContainer)) {
    return rangeFromPoint;
  }
  return getSelectionRange(container);
};

const mapPlainOffsetToRawIndex = (rawMarkdown: string, plainOffset: number) => {
  if (plainOffset <= 0) {
    return 0;
  }
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      if (plainIndex >= plainOffset) {
        return rawIndex;
      }
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    if (lineStart && !inFence) {
      if (char === "#") {
        while (rawMarkdown[rawIndex] === "#") {
          rawIndex += 1;
        }
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (char === ">") {
        rawIndex += 1;
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (
        (char === "-" || char === "*" || char === "+") &&
        rawMarkdown[rawIndex + 1] === " "
      ) {
        rawIndex += 2;
        continue;
      }
      if (char >= "0" && char <= "9") {
        const markerStart = rawIndex;
        while (rawMarkdown[rawIndex] >= "0" && rawMarkdown[rawIndex] <= "9") {
          rawIndex += 1;
        }
        if (
          rawMarkdown[rawIndex] === "." &&
          rawMarkdown[rawIndex + 1] === " "
        ) {
          rawIndex += 2;
          continue;
        }
        rawIndex = markerStart;
      }
    }

    lineStart = false;

    if (!inFence) {
      if (inLinkUrl) {
        if (char === ")") {
          inLinkUrl = false;
        }
        rawIndex += 1;
        continue;
      }
      if (char === "`") {
        inInlineCode = !inInlineCode;
        rawIndex += 1;
        continue;
      }
      if (!inInlineCode && (char === "*" || char === "_")) {
        rawIndex += 1;
        continue;
      }
      if (char === "!" && rawMarkdown[rawIndex + 1] === "[") {
        rawIndex += 1;
        continue;
      }
      if (char === "[") {
        inLinkText = true;
        rawIndex += 1;
        continue;
      }
      if (inLinkText && char === "]") {
        inLinkText = false;
        if (rawMarkdown[rawIndex + 1] === "(") {
          inLinkUrl = true;
          rawIndex += 2;
          continue;
        }
        rawIndex += 1;
        continue;
      }
    }

    if (plainIndex >= plainOffset) {
      return rawIndex;
    }
    plainIndex += 1;
    rawIndex += 1;
  }

  return rawMarkdown.length;
};

const mapRawIndexToPlainOffset = (rawMarkdown: string, rawIndexTarget: number) => {
  if (rawIndexTarget <= 0) {
    return 0;
  }
  const target = Math.min(rawIndexTarget, rawMarkdown.length);
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length && rawIndex < target) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    if (lineStart && !inFence) {
      if (char === "#") {
        while (rawMarkdown[rawIndex] === "#") {
          rawIndex += 1;
        }
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (char === ">") {
        rawIndex += 1;
        if (rawMarkdown[rawIndex] === " ") {
          rawIndex += 1;
        }
        continue;
      }
      if (
        (char === "-" || char === "*" || char === "+") &&
        rawMarkdown[rawIndex + 1] === " "
      ) {
        rawIndex += 2;
        continue;
      }
      if (char >= "0" && char <= "9") {
        const markerStart = rawIndex;
        while (rawMarkdown[rawIndex] >= "0" && rawMarkdown[rawIndex] <= "9") {
          rawIndex += 1;
        }
        if (
          rawMarkdown[rawIndex] === "." &&
          rawMarkdown[rawIndex + 1] === " "
        ) {
          rawIndex += 2;
          continue;
        }
        rawIndex = markerStart;
      }
    }

    lineStart = false;

    if (!inFence) {
      if (inLinkUrl) {
        if (char === ")") {
          inLinkUrl = false;
        }
        rawIndex += 1;
        continue;
      }
      if (char === "`") {
        inInlineCode = !inInlineCode;
        rawIndex += 1;
        continue;
      }
      if (!inInlineCode && (char === "*" || char === "_")) {
        rawIndex += 1;
        continue;
      }
      if (char === "!" && rawMarkdown[rawIndex + 1] === "[") {
        rawIndex += 1;
        continue;
      }
      if (char === "[") {
        inLinkText = true;
        rawIndex += 1;
        continue;
      }
      if (inLinkText && char === "]") {
        inLinkText = false;
        if (rawMarkdown[rawIndex + 1] === "(") {
          inLinkUrl = true;
          rawIndex += 2;
          continue;
        }
        rawIndex += 1;
        continue;
      }
    }

    plainIndex += 1;
    rawIndex += 1;
  }

  return plainIndex;
};

const findTextNodeAtOffset = (container: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );
  const range = document.createRange();
  range.setStart(container, 0);

  let current = walker.nextNode() as Text | null;
  let lastTextNode: Text | null = null;

  while (current) {
    lastTextNode = current;
    const nodeLength = current.nodeValue?.length ?? 0;
    range.setEnd(current, nodeLength);
    const endOffset = range.toString().length;

    if (offset <= endOffset) {
      let low = 0;
      let high = nodeLength;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        range.setEnd(current, mid);
        const midOffset = range.toString().length;
        if (midOffset < offset) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return { node: current, offset: low };
    }

    current = walker.nextNode() as Text | null;
  }

  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.nodeValue?.length ?? 0,
    };
  }

  return null;
};

const setCaretAtPlainOffset = (container: HTMLElement, offset: number) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const length = container.innerText.length;
  const clampedOffset = Math.max(0, Math.min(offset, length));
  const resolved = findTextNodeAtOffset(container, clampedOffset);
  const range = document.createRange();
  if (resolved) {
    range.setStart(resolved.node, resolved.offset);
  } else {
    range.setStart(container, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const escapeMarkdownText = (text: string) =>
  text
    .replace(/\u00a0/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~");

const escapeMarkdownLinkText = (text: string) =>
  text.replace(/\[/g, "\\[").replace(/]/g, "\\]");

const escapeMarkdownTableCell = (text: string) =>
  text.replace(/\|/g, "\\|");

const wrapInlineCode = (text: string) => {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\n+/g, " ");
  const matches = normalized.match(/`+/g);
  const fenceLength = matches
    ? Math.max(...matches.map((match) => match.length)) + 1
    : 1;
  const fence = "`".repeat(fenceLength);
  const needsPadding =
    normalized.startsWith(" ") || normalized.endsWith(" ");
  const content = needsPadding ? ` ${normalized} ` : normalized;
  return `${fence}${content}${fence}`;
};

const wrapCodeBlock = (text: string) => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const matches = normalized.match(/`+/g);
  const fenceLength = matches
    ? Math.max(...matches.map((match) => match.length)) + 1
    : 3;
  const fence = "`".repeat(Math.max(3, fenceLength));
  const trimmed = normalized.replace(/\n$/, "");
  return `${fence}\n${trimmed}\n${fence}\n\n`;
};

type MarkdownSerializeContext = {
  listDepth: number;
};

const serializeMarkdownChildren = (
  node: ParentNode,
  context: MarkdownSerializeContext,
) =>
  Array.from(node.childNodes)
    .map((child) => serializeMarkdownNode(child, context))
    .join("");

const serializeMarkdownNode = (
  node: Node,
  context: MarkdownSerializeContext,
): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownText(node.nodeValue ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === "br") {
    return "\n";
  }

  if (tag === "p" || tag === "div") {
    const content = serializeMarkdownChildren(element, context).trim();
    return content ? `${content}\n\n` : "\n\n";
  }

  if (tag.startsWith("h") && tag.length === 2) {
    const level = Number(tag[1]);
    if (!Number.isNaN(level)) {
      const content = serializeMarkdownChildren(element, context).trim();
      return `${"#".repeat(level)} ${content}\n\n`;
    }
  }

  if (tag === "strong" || tag === "b") {
    return `**${serializeMarkdownChildren(element, context)}**`;
  }

  if (tag === "em" || tag === "i") {
    return `*${serializeMarkdownChildren(element, context)}*`;
  }

  if (tag === "del" || tag === "s") {
    return `~~${serializeMarkdownChildren(element, context)}~~`;
  }

  if (tag === "code") {
    if (element.parentElement?.tagName.toLowerCase() === "pre") {
      return "";
    }
    return wrapInlineCode(element.textContent ?? "");
  }

  if (tag === "pre") {
    const code = element.querySelector("code")?.textContent ?? element.textContent ?? "";
    return wrapCodeBlock(code);
  }

  if (tag === "blockquote") {
    const content = serializeMarkdownChildren(element, context)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const lines = content.split("\n");
    return `${lines.map((line) => (line ? `> ${line}` : ">")).join("\n")}\n\n`;
  }

  if (tag === "ul" || tag === "ol") {
    return serializeMarkdownList(element, context);
  }

  if (tag === "li") {
    return serializeMarkdownChildren(element, context).trim();
  }

  if (tag === "a") {
    const href = element.getAttribute("href") ?? "";
    const text = serializeMarkdownChildren(element, context).trim();
    if (!href) {
      return text;
    }
    return `[${escapeMarkdownLinkText(text)}](${href})`;
  }

  if (tag === "hr") {
    return "---\n\n";
  }

  if (tag === "table") {
    return serializeMarkdownTable(element, context);
  }

  return serializeMarkdownChildren(element, context);
};

const serializeMarkdownList = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const isOrdered = element.tagName.toLowerCase() === "ol";
  let index = Number(element.getAttribute("start") ?? "1");
  if (Number.isNaN(index)) {
    index = 1;
  }
  const indent = "  ".repeat(context.listDepth);
  const items = Array.from(element.children).filter(
    (child) => child.tagName.toLowerCase() === "li",
  );
  const lines: string[] = [];

  items.forEach((item, itemIndex) => {
    const content = serializeMarkdownChildren(item, {
      ...context,
      listDepth: context.listDepth + 1,
    })
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const marker = isOrdered ? `${index + itemIndex}. ` : "- ";
    const itemLines = content ? content.split("\n") : [""];
    lines.push(`${indent}${marker}${itemLines[0]}`);
    itemLines.slice(1).forEach((line) => {
      lines.push(`${indent}  ${line}`);
    });
  });

  return `${lines.join("\n")}\n\n`;
};

const serializeMarkdownTable = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const rows = Array.from(element.querySelectorAll("tr"));
  if (rows.length === 0) {
    return "";
  }
  const headerRow =
    element.querySelector("thead tr") ?? rows[0];
  const headerCells = Array.from(headerRow.children).map((cell) =>
    serializeTableCell(cell as HTMLElement, context),
  );
  const bodyRows = rows.filter((row) => row !== headerRow);

  const headerLine = `| ${headerCells.join(" | ")} |`;
  const separatorLine = `| ${headerCells.map(() => "---").join(" | ")} |`;
  const bodyLines = bodyRows.map((row) => {
    const cells = Array.from(row.children).map((cell) =>
      serializeTableCell(cell as HTMLElement, context),
    );
    return `| ${cells.join(" | ")} |`;
  });

  return `${[headerLine, separatorLine, ...bodyLines].join("\n")}\n\n`;
};

const serializeTableCell = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const text = serializeMarkdownChildren(element, context)
    .replace(/\n+/g, " ")
    .trim();
  return escapeMarkdownTableCell(text);
};

const serializeMarkdownFromHtml = (container: HTMLElement) => {
  const markdown = serializeMarkdownChildren(container, { listDepth: 0 });
  return markdown.replace(/\n{3,}/g, "\n\n").trimEnd();
};

const resolveRawCaretIndex = (container: HTMLElement, range: Range | null) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  return getRangeOffset(container, resolvedRange);
};

const resolveMarkdownCaretIndex = (
  container: HTMLElement,
  rawMarkdown: string,
  range: Range | null,
) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  const plainOffset = getRangeOffset(container, resolvedRange);
  if (rawMarkdown.length === 0) {
    return 0;
  }
  return mapPlainOffsetToRawIndex(rawMarkdown, plainOffset);
};

const isInteractionMarkerLine = (line: string) => {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "-true" ||
    trimmed === "-false" ||
    (trimmed.length === 2 &&
      trimmed[0] === "-" &&
      trimmed[1] >= "a" &&
      trimmed[1] <= "d");
};

const isExamTaskStartLine = (line: string) => {
  let trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("**")) {
    trimmed = trimmed.slice(2).trimStart();
  }

  if (trimmed.startsWith("-")) {
    trimmed = trimmed.slice(1);
  }

  const numberMatch = trimmed.match(/^(\d+)/);
  if (!numberMatch) {
    return false;
  }

  const numberRaw = numberMatch[1] ?? "";
  if (numberRaw.length > 1 && numberRaw.startsWith("0")) {
    return false;
  }

  const number = Number.parseInt(numberRaw, 10);
  if (number < 1 || number > 20) {
    return false;
  }

  let remainder = trimmed.slice(numberRaw.length);
  if (remainder.startsWith(")")) {
    remainder = remainder.slice(1);
  }
  if (remainder.startsWith("**")) {
    remainder = remainder.slice(2);
  }

  return remainder.length === 0 || /^\s/.test(remainder);
};

const isExamOptionLine = (line: string) =>
  /^[a-d]\)\s+\S/i.test(line.trim());

// Keep exam task numbering like "1)" editable by avoiding ordered-list parsing.
const escapeExamTaskListMarker = (line: string) => {
  if (!isExamTaskStartLine(line)) {
    return line;
  }
  const match = line.match(/^(\s*)(\d+)\)/);
  if (!match) {
    return line;
  }
  return `${match[1]}${match[2]}\\)${line.slice(match[0].length)}`;
};

const shouldExpandInlineExamLine = (line: string) => {
  const lowered = line.toLowerCase();
  return lowered.includes("#card") ||
    /\s-[a-d]\b/.test(lowered) ||
    /\s-(true|false)\b/.test(lowered) ||
    /\b[a-d]\)\s+\S/.test(lowered);
};

const ensureHardBreakSpacing = (value: string) => {
  if (!value) {
    return value;
  }
  const match = value.match(/[ \t]+$/);
  const trailingLength = match ? match[0].length : 0;
  if (trailingLength >= 2) {
    return value;
  }
  return `${value}${" ".repeat(2 - trailingLength)}`;
};

const splitExpandedExamLine = (expanded: string) => {
  const parts = expanded.split("\n");
  if (parts.length <= 1) {
    return parts;
  }
  return parts.map((part, index) => {
    if (index === parts.length - 1 || part === "") {
      return part;
    }
    return ensureHardBreakSpacing(part);
  });
};

const expandInlineExamLine = (line: string) => {
  if (!line || !shouldExpandInlineExamLine(line)) {
    return [line];
  }

  let expanded = line;
  expanded = expanded.replace(/\s*#card\s*/gi, "\n#card\n");
  expanded = expanded.replace(/\s-((?:true|false)|[a-d])\b/gi, "\n-$1");
  expanded = expanded.replace(/\s([a-d]\))\s*/gi, "\n$1 ");
  if (expanded.toLowerCase().includes("#card")) {
    expanded = expanded.replace(/\s#\s*/g, "\n#\n");
  }

  return splitExpandedExamLine(expanded);
};

export const applyInteractionSpacing = (markdown: string) => {
  if (!markdown) {
    return markdown;
  }
  // Preserve hard breaks and marker lines because exam/flashcard parsing is line-based.
  const sourceLines = markdown.split("\n");
  const expandedLines: string[] = [];
  let inCodeFence = false;

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      expandedLines.push(line);
      continue;
    }
    if (inCodeFence) {
      expandedLines.push(line);
      continue;
    }
    expandedLines.push(...expandInlineExamLine(line));
  }

  const result: string[] = [];
  inCodeFence = false;

  for (let i = 0; i < expandedLines.length; i += 1) {
    const line = expandedLines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      result.push(line);
      continue;
    }

    result.push(line);
    if (inCodeFence || !isInteractionMarkerLine(trimmed)) {
      continue;
    }

    const nextLine = expandedLines[i + 1] ?? "";
    const nextTrimmed = nextLine.trim();
    if (nextTrimmed === "" || isInteractionMarkerLine(nextTrimmed)) {
      continue;
    }
    result.push("");
  }

  const normalized: string[] = [];
  inCodeFence = false;

  for (let i = 0; i < result.length; i += 1) {
    const line = result[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      normalized.push(line);
      continue;
    }
    if (inCodeFence) {
      normalized.push(line);
      continue;
    }

    let nextLine = line;
    if (trimmed) {
      if (isExamTaskStartLine(nextLine)) {
        nextLine = escapeExamTaskListMarker(nextLine);
        nextLine = ensureHardBreakSpacing(nextLine);
      } else if (isExamOptionLine(nextLine)) {
        nextLine = ensureHardBreakSpacing(nextLine);
      }
    }
    normalized.push(nextLine);
  }

  return normalized.join("\n");
};

export const PreviewPanel = ({
  editDraft,
  editError,
  editCaretIndex,
  isEditing,
  emptyPreview,
  preview,
  previewError,
  previewState,
  rawPreview,
  selectedFile,
  canEdit,
  onEditChange,
  onEditCaretApplied,
  onEditExit,
  onEditStart,
  onToggleRawPreview,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownEditorRef = useRef<HTMLDivElement | null>(null);
  const markdownEditorHtmlRef = useRef<string | null>(null);
  const markdownEditorReadyRef = useRef(false);
  const scrollStateRef = useRef({ top: 0, left: 0 });
  const lastCaretIndexRef = useRef<number | null>(null);

  const captureScroll = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }
    scrollStateRef.current.top = element.scrollTop;
    scrollStateRef.current.left = element.scrollLeft;
  }, []);

  const restoreScroll = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }
    element.scrollTop = scrollStateRef.current.top;
    element.scrollLeft = scrollStateRef.current.left;
  }, []);

  useLayoutEffect(() => {
    if (!isEditing || rawPreview) {
      markdownEditorReadyRef.current = false;
      if (!isEditing) {
        markdownEditorHtmlRef.current = null;
      }
      return;
    }
    if (!markdownEditorRef.current || markdownEditorReadyRef.current) {
      return;
    }
    markdownEditorRef.current.innerHTML = markdownEditorHtmlRef.current ?? "";
    markdownEditorReadyRef.current = true;
  }, [isEditing, rawPreview]);

  useLayoutEffect(() => {
    if (isEditing) {
      if (rawPreview) {
        restoreScroll(editorRef.current);
      } else {
        restoreScroll(markdownEditorRef.current);
      }
      return;
    }
    restoreScroll(previewRef.current);
  }, [isEditing, rawPreview, restoreScroll]);

  useEffect(() => {
    if (!isEditing || !rawPreview || !editorRef.current) {
      return;
    }
    if (typeof editCaretIndex !== "number") {
      return;
    }
    const editor = editorRef.current;
    const desiredIndex = editCaretIndex;
    const nextIndex = Math.max(0, Math.min(desiredIndex, editor.value.length));
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(nextIndex, nextIndex);
      lastCaretIndexRef.current = nextIndex;
      scrollStateRef.current.top = editor.scrollTop;
      scrollStateRef.current.left = editor.scrollLeft;
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, isEditing, onEditCaretApplied, rawPreview]);

  useEffect(() => {
    if (!isEditing || rawPreview || !markdownEditorRef.current) {
      return;
    }
    if (typeof editCaretIndex !== "number") {
      return;
    }
    const editor = markdownEditorRef.current;
    const plainOffset = mapRawIndexToPlainOffset(editDraft, editCaretIndex);
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      setCaretAtPlainOffset(editor, plainOffset);
      lastCaretIndexRef.current = editCaretIndex;
      scrollStateRef.current.top = editor.scrollTop;
      scrollStateRef.current.left = editor.scrollLeft;
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [editCaretIndex, editDraft, isEditing, onEditCaretApplied, rawPreview]);

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!canEdit || isEditing) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      const origin = rawPreview ? "raw" : "markdown";
      let caretIndex = preview.length === 0 ? 0 : null;
      if (previewRef.current) {
        const container = previewRef.current;
        captureScroll(container);
        const selection = getSelectionRange(container);
        if (selection && !selection.collapsed) {
          return;
        }
        const range = getRangeFromEvent(event, container);
        const resolvedIndex = rawPreview
          ? resolveRawCaretIndex(container, range)
          : resolveMarkdownCaretIndex(container, preview, range);
        if (typeof resolvedIndex === "number") {
          caretIndex = resolvedIndex;
        }
        if (!rawPreview) {
          markdownEditorHtmlRef.current = container.innerHTML;
        }
      } else if (!rawPreview) {
        markdownEditorHtmlRef.current = "";
      }
      if (caretIndex === null) {
        if (typeof lastCaretIndexRef.current === "number") {
          caretIndex = lastCaretIndexRef.current;
        } else if (preview.length > 0) {
          caretIndex = preview.length;
        }
      }
      if (typeof caretIndex === "number") {
        lastCaretIndexRef.current = caretIndex;
      }
      onEditStart({ caretIndex, origin });
    },
    [canEdit, captureScroll, isEditing, onEditStart, preview, rawPreview],
  );

  const handleRawEditorBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      captureScroll(event.currentTarget);
      const caretIndex = event.currentTarget.selectionStart;
      if (typeof caretIndex === "number") {
        lastCaretIndexRef.current = caretIndex;
      } else {
        lastCaretIndexRef.current = event.currentTarget.value.length;
      }
      onEditExit();
    },
    [captureScroll, onEditExit],
  );

  const handleMarkdownEditorBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      captureScroll(event.currentTarget);
      const caretIndex = resolveMarkdownCaretIndex(
        event.currentTarget,
        editDraft,
        null,
      );
      if (typeof caretIndex === "number") {
        lastCaretIndexRef.current = caretIndex;
      }
      onEditExit();
    },
    [captureScroll, editDraft, onEditExit],
  );

  const handleMarkdownInput = useCallback(() => {
    if (!markdownEditorRef.current) {
      return;
    }
    const nextValue = serializeMarkdownFromHtml(markdownEditorRef.current);
    onEditChange(nextValue);
  }, [onEditChange]);

  const renderedPreview = rawPreview ? preview : applyInteractionSpacing(preview);

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <h2>Preview</h2>
          <p className="muted">
            {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
          </p>
        </div>
        <div className="preview-actions">
          <button
            type="button"
            className={`ghost small ${rawPreview ? "active" : ""}`}
            onClick={onToggleRawPreview}
            aria-pressed={rawPreview}
            disabled={!selectedFile}
          >
            {rawPreview ? "Markdown" : "Rohtext"}
          </button>
          {previewState === "loading" ? <span className="chip">Lade...</span> : null}
        </div>
      </div>
      <div className="panel-body preview-body">
        {previewState === "error" ? (
          <div className="error">{previewError}</div>
        ) : null}
        <div className="preview-content" onMouseUp={handlePreviewClick}>
          {isEditing ? (
            rawPreview ? (
              <textarea
                key="raw-edit"
                ref={editorRef}
                className="preview-editor"
                value={editDraft}
                onChange={(event) => onEditChange(event.target.value)}
                onBlur={handleRawEditorBlur}
                onScroll={(event) => captureScroll(event.currentTarget)}
                aria-label="Edit markdown preview"
              />
            ) : (
              <div
                key="markdown-edit"
                ref={markdownEditorRef}
                className="preview preview-editor markdown"
                contentEditable
                suppressContentEditableWarning
                onInput={handleMarkdownInput}
                onBlur={handleMarkdownEditorBlur}
                onScroll={(event) => captureScroll(event.currentTarget)}
                role="textbox"
                aria-multiline="true"
                aria-label="Edit markdown preview"
              />
            )
          ) : preview ? (
            <div
              key={rawPreview ? "raw-view" : "markdown-view"}
              ref={previewRef}
              className={`preview ${rawPreview ? "raw" : "markdown"}`}
              onScroll={(event) => captureScroll(event.currentTarget)}
            >
              {rawPreview ? (
                <pre>{preview}</pre>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeSanitize, markdownSchema]]}
                  components={{
                    table: ({ node: _node, ...props }) => (
                      <div className="markdown-table">
                        <table {...props} />
                      </div>
                    ),
                  }}
                >
                  {renderedPreview}
                </ReactMarkdown>
              )}
            </div>
          ) : (
            <div key="preview-empty" className="preview placeholder">
              {emptyPreview}
            </div>
          )}
        </div>
        {editError ? <div className="error">{editError}</div> : null}
      </div>
    </section>
  );
};
