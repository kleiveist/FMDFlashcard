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
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  addFrontmatterProperty,
  collectFrontmatterValueSuggestions,
  extractWikilinkTarget,
  type FrontmatterProperty,
  type FrontmatterPropertyIcon,
  type FrontmatterPropertyKind,
  composeMarkdownWithBody,
  isLinkPropertyKey,
  normalizeWikilinkValue,
  parseFrontmatterDocument,
  parseFrontmatterLinks,
  removeFrontmatterProperty,
  reorderFrontmatterProperties,
  updateFrontmatterLinks,
  updateFrontmatterProperty,
} from "../features/preview/frontmatter";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";
import { ChevronDownIcon, CodeIcon, MarkdownIcon } from "./icons";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "br",
    "kbd",
    "span",
    "sub",
    "sup",
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
    ol: [...(defaultSchema.attributes?.ol ?? []), "data-md-ordered-delimiter"],
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
  },
};

const safeLinkProtocols = new Set(["http:", "https:", "mailto:"]);

const resolveSafeHref = (href: string) => {
  if (!href) {
    return null;
  }
  try {
    const parsed = new URL(href);
    if (!safeLinkProtocols.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const resolveEventElement = (target: EventTarget | null) => {
  if (!target) {
    return null;
  }
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Node && target.parentElement) {
    return target.parentElement;
  }
  return null;
};

const resolveAnchorTarget = (target: EventTarget | null) => {
  const element = resolveEventElement(target);
  return element?.closest("a[href]") as HTMLAnchorElement | null;
};

const copyTextToClipboard = async (value: string) => {
  if (!value) {
    return;
  }
  const normalized = value.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(normalized);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = normalized;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const exec = (document as Document & {
      execCommand?: (command: string) => boolean;
    }).execCommand;
    if (typeof exec === "function") {
      exec.call(document, "copy");
    }
  } finally {
    textarea.remove();
  }
};

const isModifierClick = (event: Pick<MouseEvent<HTMLElement>, "metaKey" | "ctrlKey">) =>
  event.metaKey || event.ctrlKey;

type MarkdownAstNode = {
  type?: string;
  value?: string;
  ordered?: boolean;
  data?: {
    hProperties?: Record<string, unknown>;
  };
  position?: {
    start?: {
      offset?: number;
      line?: number;
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

const remarkPreserveSoftBreaks = () => (tree: MarkdownAstNode) => {
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

const resolveOrderedListDelimiter = (
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

const remarkPreserveOrderedListDelimiters = () =>
  (tree: MarkdownAstNode, file: { value?: unknown }) => {
    const source = typeof file.value === "string" ? file.value : "";
    if (!source) {
      return;
    }
    preserveOrderedListDelimiter(tree, source);
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
  markdownViewEditEnabled: boolean;
  selectedFile: VaultFile | null;
  canEdit: boolean;
  markdownEditorStyle?: CSSProperties;
  onEditChange: (value: string) => void;
  onEditCaretApplied: () => void;
  onEditExit: () => void;
  onEditStart: (options?: {
    caretIndex?: number | null;
    origin?: "raw" | "markdown";
  }) => void;
  onToggleRawPreview: () => void;
  onFrontmatterSave?: (nextPreview: string) => Promise<boolean>;
  onNavigateWikilink?: (wikilink: string) => void;
  valueSuggestionsByKey?: Record<string, string[]>;
  keySuggestions?: string[];
};

export const canStartPreviewEdit = ({
  rawPreview,
  markdownViewEditEnabled,
}: {
  rawPreview: boolean;
  markdownViewEditEnabled: boolean;
}) => rawPreview || markdownViewEditEnabled;

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
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) {
    return doc.caretRangeFromPoint(x, y) ?? null;
  }
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (position) {
      const range = doc.createRange();
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

type MarkdownOffsetMapOptions = {
  skipStructuralMarkers?: boolean;
};

const shouldSkipStructuralMarkers = (options?: MarkdownOffsetMapOptions) =>
  options?.skipStructuralMarkers ?? true;

const resolveListLineMarkerEnd = (rawMarkdown: string, startIndex: number) => {
  const first = rawMarkdown[startIndex];
  if (first === "-" || first === "*" || first === "+") {
    if (rawMarkdown[startIndex + 1] !== " ") {
      return null;
    }
    if (
      rawMarkdown[startIndex + 2] === "[" &&
      (rawMarkdown[startIndex + 3] === " " ||
        rawMarkdown[startIndex + 3] === "x" ||
        rawMarkdown[startIndex + 3] === "X") &&
      rawMarkdown[startIndex + 4] === "]" &&
      rawMarkdown[startIndex + 5] === " "
    ) {
      return startIndex + 6;
    }
    return startIndex + 2;
  }

  if (first >= "0" && first <= "9") {
    let index = startIndex;
    while (rawMarkdown[index] >= "0" && rawMarkdown[index] <= "9") {
      index += 1;
    }
    if (
      (rawMarkdown[index] === "." || rawMarkdown[index] === ")") &&
      rawMarkdown[index + 1] === " "
    ) {
      return index + 2;
    }
  }

  return null;
};

const resolveThematicBreakLineEnd = (rawMarkdown: string, startIndex: number) => {
  let index = startIndex;
  let dashCount = 0;
  while (index < rawMarkdown.length && rawMarkdown[index] !== "\n") {
    const char = rawMarkdown[index];
    if (char === "-") {
      dashCount += 1;
      index += 1;
      continue;
    }
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }
    return null;
  }
  return dashCount >= 3 ? index : null;
};

const mapPlainOffsetToRawIndex = (
  rawMarkdown: string,
  plainOffset: number,
  options?: MarkdownOffsetMapOptions,
) => {
  if (plainOffset <= 0) {
    return 0;
  }
  const skipStructuralMarkers = shouldSkipStructuralMarkers(options);
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;
  let escapeNext = false;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && !escapeNext && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      escapeNext = false;
      if (plainIndex >= plainOffset) {
        return rawIndex;
      }
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    const isEscaped = escapeNext;
    if (escapeNext) {
      escapeNext = false;
    }

    if (!inFence && !isEscaped && char === "\\") {
      lineStart = false;
      escapeNext = true;
      rawIndex += 1;
      continue;
    }

    if (!isEscaped && lineStart && !inFence && skipStructuralMarkers) {
      const thematicBreakEnd = resolveThematicBreakLineEnd(rawMarkdown, rawIndex);
      if (thematicBreakEnd !== null) {
        rawIndex = thematicBreakEnd;
        continue;
      }
      const listMarkerEnd = resolveListLineMarkerEnd(rawMarkdown, rawIndex);
      if (listMarkerEnd !== null) {
        rawIndex = listMarkerEnd;
        continue;
      }
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
      if (!isEscaped) {
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
    }

    if (plainIndex >= plainOffset) {
      return rawIndex;
    }
    plainIndex += 1;
    rawIndex += 1;
  }

  return rawMarkdown.length;
};

const mapRawIndexToPlainOffset = (
  rawMarkdown: string,
  rawIndexTarget: number,
  options?: MarkdownOffsetMapOptions,
) => {
  if (rawIndexTarget <= 0) {
    return 0;
  }
  const skipStructuralMarkers = shouldSkipStructuralMarkers(options);
  const target = Math.min(rawIndexTarget, rawMarkdown.length);
  let rawIndex = 0;
  let plainIndex = 0;
  let inFence = false;
  let inInlineCode = false;
  let inLinkText = false;
  let inLinkUrl = false;
  let lineStart = true;
  let escapeNext = false;

  const skipToLineEnd = () => {
    while (rawIndex < rawMarkdown.length && rawMarkdown[rawIndex] !== "\n") {
      rawIndex += 1;
    }
  };

  while (rawIndex < rawMarkdown.length && rawIndex < target) {
    const char = rawMarkdown[rawIndex];

    if (lineStart && !escapeNext && rawMarkdown.startsWith("```", rawIndex)) {
      inFence = !inFence;
      skipToLineEnd();
      continue;
    }

    if (char === "\n") {
      lineStart = true;
      escapeNext = false;
      plainIndex += 1;
      rawIndex += 1;
      continue;
    }

    const isEscaped = escapeNext;
    if (escapeNext) {
      escapeNext = false;
    }

    if (!inFence && !isEscaped && char === "\\") {
      lineStart = false;
      escapeNext = true;
      rawIndex += 1;
      continue;
    }

    if (!isEscaped && lineStart && !inFence && skipStructuralMarkers) {
      const thematicBreakEnd = resolveThematicBreakLineEnd(rawMarkdown, rawIndex);
      if (thematicBreakEnd !== null) {
        rawIndex = thematicBreakEnd;
        continue;
      }
      const listMarkerEnd = resolveListLineMarkerEnd(rawMarkdown, rawIndex);
      if (listMarkerEnd !== null) {
        rawIndex = listMarkerEnd;
        continue;
      }
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
      if (!isEscaped) {
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

const replaceHeadingElementLevel = (heading: HTMLElement, level: number) => {
  const normalizedLevel = Math.max(1, Math.min(6, level));
  const targetTag = `h${normalizedLevel}`;
  if (heading.tagName.toLowerCase() === targetTag) {
    return heading;
  }

  const replacement = heading.ownerDocument.createElement(targetTag);
  Array.from(heading.attributes).forEach((attribute) => {
    if (attribute.name === "data-md-heading-active") {
      return;
    }
    replacement.setAttribute(attribute.name, attribute.value);
  });

  while (heading.firstChild) {
    replacement.appendChild(heading.firstChild);
  }
  heading.replaceWith(replacement);
  return replacement;
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

const isFmdDirectiveLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === "---") {
    return true;
  }
  const lowered = trimmed.toLowerCase();
  if (
    lowered === "#" ||
    lowered === "#exam" ||
    lowered === "#examend" ||
    lowered === "#card" ||
    lowered === "#help" ||
    lowered === "#helpend"
  ) {
    return true;
  }
  return isInteractionMarkerLine(trimmed);
};

const escapeMarkdownLineStart = (line: string) => {
  if (!line || isFmdDirectiveLine(line)) {
    return line;
  }
  const match = line.match(/^([ \t]*)(.*)$/);
  if (!match) {
    return line;
  }
  const indent = match[1];
  const content = match[2];
  if (!content) {
    return line;
  }
  if (/^#+(?=\s|$)/.test(content)) {
    return `${indent}\\${content}`;
  }
  if (content.startsWith("-") && (content.length === 1 || content[1] === " ")) {
    return `${indent}\\${content}`;
  }
  return line;
};

const escapeMarkdownLineStarts = (value: string) =>
  value
    .split(/(\r?\n)/)
    .map((part, index) =>
      index % 2 === 1 ? part : escapeMarkdownLineStart(part),
    )
    .join("");

const escapeMarkdownText = (text: string, escapePipes = true) => {
  let next = text
    .replace(/\u00a0/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~");
  if (escapePipes) {
    next = next.replace(/\|/g, "\\|");
  }
  return escapeMarkdownLineStarts(next);
};

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
  if (trimmed.trim().length === 0) {
    return `${fence}\n${fence}\n`;
  }
  return `${fence}\n${trimmed}\n${fence}\n`;
};

const resolveCodeFenceFromOpenMarker = (openMarker: string) =>
  openMarker.match(/^`{3,}/)?.[0] ?? "```";

const normalizeOpenCodeFenceMarker = (value: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed || !/^`{3,}/.test(trimmed)) {
    return "```";
  }
  return trimmed;
};

const normalizeCloseCodeFenceMarker = (
  value: string | null,
  openMarker: string,
) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed || !/^`{3,}$/.test(trimmed)) {
    return resolveCodeFenceFromOpenMarker(openMarker);
  }
  return trimmed;
};

const wrapCodeBlockWithMarkers = (
  text: string,
  openMarker: string,
  closeMarker: string,
) => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const trimmed = normalized.replace(/\n$/, "");
  if (trimmed.trim().length === 0) {
    return `${openMarker}\n${closeMarker}\n`;
  }
  return `${openMarker}\n${trimmed}\n${closeMarker}\n`;
};

type MarkdownSerializeContext = {
  listDepth: number;
  escapePipes: boolean;
  inContentEditable: boolean;
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
    let value = node.nodeValue ?? "";
    if (context.inContentEditable) {
      if (value.trim() === "" && /[\r\n]/.test(value)) {
        // Ignore editor-only whitespace separators between block nodes to avoid
        // rewriting single-line sequences into paragraph-separated output.
        return "";
      }

      const previousTag = node.previousSibling instanceof HTMLElement
        ? node.previousSibling.tagName.toLowerCase()
        : null;
      const nextTag = node.nextSibling instanceof HTMLElement
        ? node.nextSibling.tagName.toLowerCase()
        : null;

      // Browsers can inject newline text nodes around <br> in contentEditable.
      // Keep line breaks owned by <br> and strip duplicate newline chars from text.
      if (previousTag === "br") {
        value = value.replace(/^[\r\n]+[ \t]*/g, "");
      }
      if (nextTag === "br") {
        value = value.replace(/[ \t]*[\r\n]+$/g, "");
      }
    }
    return escapeMarkdownText(value, context.escapePipes);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === "button" && element.classList.contains("md-code-copy-button")) {
    return "";
  }

  if (tag === "br") {
    return "\n";
  }

  if (tag === "p") {
    const content = serializeMarkdownChildren(element, context).trim();
    if (context.inContentEditable) {
      return content ? `${content}\n` : "\n";
    }
    return content ? `${content}\n\n` : "\n\n";
  }

  if (tag === "div") {
    // contentEditable uses div per line; keep single newline to avoid extra gaps.
    const content = serializeMarkdownChildren(element, context).trim();
    return content ? `${content}\n` : "\n";
  }

  if (tag.startsWith("h") && tag.length === 2) {
    const levelFromTag = Number(tag[1]);
    if (!Number.isNaN(levelFromTag)) {
      const content = serializeMarkdownChildren(element, context).trim();
      const markerMatch = content.match(/^\\?(#{1,6})(?:\s+|$)([\s\S]*)$/);
      const manualLevel = markerMatch ? markerMatch[1].length : null;
      const manualContent = markerMatch ? markerMatch[2].trimStart() : content;
      const resolvedLevel = Math.max(1, Math.min(6, manualLevel ?? levelFromTag));
      const newlineSuffix = context.inContentEditable ? "\n" : "\n\n";
      return manualContent
        ? `${"#".repeat(resolvedLevel)} ${manualContent}${newlineSuffix}`
        : `${"#".repeat(resolvedLevel)}${newlineSuffix}`;
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
    const contentClone = element.cloneNode(true) as HTMLElement;
    contentClone.querySelectorAll(".md-code-fence-line").forEach((line) => line.remove());
    const code = contentClone.querySelector("code")?.textContent ?? contentClone.textContent ?? "";
    if (context.inContentEditable) {
      const openMarkerText = element.querySelector(
        ".md-code-fence-open > .md-code-fence-marker",
      )?.textContent ?? null;
      const closeMarkerText = element.querySelector(
        ".md-code-fence-close > .md-code-fence-marker",
      )?.textContent ?? null;
      if (
        element.hasAttribute("data-md-code-block") ||
        openMarkerText !== null ||
        closeMarkerText !== null
      ) {
        const openMarker = normalizeOpenCodeFenceMarker(openMarkerText);
        const closeMarker = normalizeCloseCodeFenceMarker(closeMarkerText, openMarker);
        return wrapCodeBlockWithMarkers(code, openMarker, closeMarker);
      }
    }
    const block = wrapCodeBlock(code);
    return context.inContentEditable ? block : `${block}\n`;
  }

  if (tag === "blockquote") {
    const content = serializeMarkdownChildren(element, context).trim();
    const lines = content.split("\n");
    const block = lines.map((line) => (line ? `> ${line}` : ">")).join("\n");
    return context.inContentEditable ? `${block}\n` : `${block}\n\n`;
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
    return context.inContentEditable ? "---\n" : "---\n\n";
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

  const resolveDefaultMarker = (itemIndex: number) =>
    isOrdered ? `${index + itemIndex}. ` : "- ";

  const resolveManualMarker = (value: string, fallback: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    const taskMatch = trimmed.match(/^([-+*])\s+\[([ xX])\]$/);
    if (taskMatch) {
      const taskBullet = taskMatch[1] ?? "-";
      const taskState = taskMatch[2] ?? " ";
      const state = taskState.toLowerCase() === "x" ? "x" : " ";
      return `${taskBullet} [${state}] `;
    }
    const orderedMatch = trimmed.match(/^(\d+)([.)])$/);
    if (orderedMatch) {
      const number = orderedMatch[1] ?? "1";
      const delimiter = orderedMatch[2] ?? ".";
      return `${number}${delimiter} `;
    }
    if (/^[-+*]$/.test(trimmed)) {
      return `${trimmed} `;
    }
    return fallback;
  };

  items.forEach((item, itemIndex) => {
    const defaultMarker = resolveDefaultMarker(itemIndex);
    const markerElement = item.firstElementChild instanceof HTMLElement &&
        item.firstElementChild.classList.contains("md-list-marker")
      ? item.firstElementChild
      : null;
    const rawMarker = markerElement?.textContent ?? "";
    const marker = resolveManualMarker(rawMarker, defaultMarker);
    const contentSource = markerElement
      ? (() => {
          const clone = item.cloneNode(true) as HTMLElement;
          if (
            clone.firstElementChild instanceof HTMLElement &&
            clone.firstElementChild.classList.contains("md-list-marker")
          ) {
            clone.firstElementChild.remove();
          }
          return clone;
        })()
      : item;
    const content = serializeMarkdownChildren(contentSource, {
      ...context,
      listDepth: context.listDepth + 1,
    })
      .trim();
    const itemLines = content ? content.split("\n") : [""];
    lines.push(`${indent}${marker}${itemLines[0]}`);
    itemLines.slice(1).forEach((line) => {
      lines.push(`${indent}  ${line}`);
    });
  });

  const block = `${lines.join("\n")}\n`;
  return context.inContentEditable ? block : `${block}\n`;
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

  const block = `${[headerLine, separatorLine, ...bodyLines].join("\n")}\n`;
  return context.inContentEditable ? block : `${block}\n`;
};

const serializeTableCell = (
  element: HTMLElement,
  context: MarkdownSerializeContext,
) => {
  const text = serializeMarkdownChildren(element, {
    ...context,
    escapePipes: false,
  })
    .replace(/\n+/g, " ")
    .trim();
  return escapeMarkdownTableCell(text);
};

type NormalizeMarkdownTablesOptions = {
  unescapeEscapedBoundaryPipes?: boolean;
};

const normalizeMarkdownTableLine = (
  line: string,
  options?: NormalizeMarkdownTablesOptions,
) => {
  const trimmed = line.trim();
  if (options?.unescapeEscapedBoundaryPipes && trimmed.startsWith("\\|")) {
    return trimmed.replace(/\\\|/g, "|");
  }
  return trimmed;
};

const isMarkdownTableRowLine = (
  line: string,
  options?: NormalizeMarkdownTablesOptions,
) => /^\|(?:[^|]*\|)+\s*$/.test(normalizeMarkdownTableLine(line, options));

const isMarkdownTableSeparatorLine = (
  line: string,
  options?: NormalizeMarkdownTablesOptions,
) => /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(
  normalizeMarkdownTableLine(line, options),
);

const isMarkdownCodeFenceLine = (line: string) =>
  /^\s*`{3,}/.test(line);

const isMarkdownCodeFenceClosingLine = (line: string) =>
  /^\s*`{3,}\s*$/.test(line);

const normalizeMarkdownTables = (
  markdown: string,
  options?: NormalizeMarkdownTablesOptions,
) => {
  if (!markdown) {
    return markdown;
  }
  const sourceLines = markdown.split("\n");
  const normalized: string[] = [];
  let inCodeFence = false;

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i] ?? "";
    if (!inCodeFence && isMarkdownCodeFenceLine(line)) {
      const lastLine = normalized[normalized.length - 1] ?? "";
      if (normalized.length > 0 && lastLine.trim() !== "") {
        normalized.push("");
      }
      normalized.push(line);
      inCodeFence = true;
      continue;
    }
    if (inCodeFence) {
      normalized.push(line);
      if (isMarkdownCodeFenceClosingLine(line)) {
        inCodeFence = false;
        const nextLine = sourceLines[i + 1] ?? "";
        if (nextLine.trim() !== "") {
          normalized.push("");
        }
      }
      continue;
    }
    const nextLine = sourceLines[i + 1] ?? "";
    const isTableStart = isMarkdownTableRowLine(line, options) &&
      isMarkdownTableSeparatorLine(nextLine, options);

    if (!isTableStart) {
      normalized.push(line);
      continue;
    }

    const lastLine = normalized[normalized.length - 1] ?? "";
    if (normalized.length > 0 && lastLine.trim() !== "") {
      normalized.push("");
    }

    while (i < sourceLines.length) {
      const tableLine = sourceLines[i] ?? "";
      if (!isMarkdownTableRowLine(tableLine, options)) {
        break;
      }
      normalized.push(normalizeMarkdownTableLine(tableLine, options));
      i += 1;
    }

    i -= 1;
    const lineAfterBlock = sourceLines[i + 1] ?? "";
    if (lineAfterBlock.trim() !== "") {
      normalized.push("");
    }
  }

  return normalized.join("\n");
};

export const normalizeTableSpacingForRender = (markdown: string) =>
  normalizeMarkdownTables(markdown);

export const serializeMarkdownFromHtml = (container: HTMLElement) => {
  const serialized = serializeMarkdownChildren(container, {
    listDepth: 0,
    escapePipes: true,
    inContentEditable: true,
  });
  return normalizeMarkdownTables(serialized, {
    unescapeEscapedBoundaryPipes: true,
  });
};

export const buildEditableMarkdownHtml = (
  container: HTMLElement,
  rawMarkdown?: string,
) => {
  const clone = container.cloneNode(true) as HTMLElement;
  const parseListMarkersFromMarkdown = (markdown: string) => {
    if (!markdown) {
      return [] as string[];
    }
    const markers: string[] = [];
    const lines = markdown.split("\n");
    let inCodeFence = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        inCodeFence = !inCodeFence;
        continue;
      }
      if (inCodeFence) {
        continue;
      }
      const taskMatch = line.match(/^\s*([-+*])\s+\[([ xX])\](?:\s|$)/);
      if (taskMatch) {
        const bullet = taskMatch[1] ?? "-";
        const stateRaw = taskMatch[2] ?? " ";
        const state = stateRaw.toLowerCase() === "x" ? "x" : " ";
        markers.push(`${bullet} [${state}] `);
        continue;
      }
      const orderedMatch = line.match(/^\s*(\d+)([.)])(?:\s|$)/);
      if (orderedMatch) {
        const number = orderedMatch[1] ?? "1";
        const delimiter = orderedMatch[2] ?? ".";
        markers.push(`${number}${delimiter} `);
        continue;
      }
      const unorderedMatch = line.match(/^\s*([-+*])(?:\s|$)/);
      if (unorderedMatch) {
        const bullet = unorderedMatch[1] ?? "-";
        markers.push(`${bullet} `);
      }
    }
    return markers;
  };

  const parseCodeFenceMarkersFromMarkdown = (markdown: string) => {
    if (!markdown) {
      return [] as Array<{ open: string; close: string }>;
    }
    const lines = markdown.split("\n");
    const markers: Array<{ open: string; close: string }> = [];
    let inFence = false;
    let openMarker = "";

    for (const line of lines) {
      if (!inFence) {
        const openMatch = line.match(/^\s*(`{3,}.*)$/);
        if (!openMatch) {
          continue;
        }
        openMarker = (openMatch[1] ?? "").trim();
        inFence = true;
        continue;
      }

      const closeMatch = line.match(/^\s*(`{3,})\s*$/);
      if (!closeMatch) {
        continue;
      }
      const normalizedOpen = normalizeOpenCodeFenceMarker(openMarker);
      markers.push({
        open: normalizedOpen,
        close: normalizeCloseCodeFenceMarker(closeMatch[1] ?? null, normalizedOpen),
      });
      openMarker = "";
      inFence = false;
    }

    if (inFence) {
      const normalizedOpen = normalizeOpenCodeFenceMarker(openMarker);
      markers.push({
        open: normalizedOpen,
        close: resolveCodeFenceFromOpenMarker(normalizedOpen),
      });
    }

    return markers;
  };

  const resolveOrderedMarker = (listItem: HTMLElement) => {
    const parent = listItem.parentElement;
    if (!parent || parent.tagName.toLowerCase() !== "ol") {
      return "1. ";
    }
    const start = Number.parseInt(parent.getAttribute("start") ?? "1", 10);
    const base = Number.isNaN(start) ? 1 : start;
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName.toLowerCase() === "li",
    );
    const itemIndex = siblings.indexOf(listItem);
    const resolvedIndex = itemIndex < 0 ? base : base + itemIndex;
    return `${resolvedIndex}. `;
  };

  const resolveTaskMarker = (listItem: HTMLElement) => {
    const checkbox = Array.from(listItem.children).find(
      (child): child is HTMLInputElement =>
        child instanceof HTMLInputElement &&
        child.type.toLowerCase() === "checkbox",
    );
    if (!checkbox && !listItem.classList.contains("task-list-item")) {
      return null;
    }
    const checked = checkbox?.checked || checkbox?.hasAttribute("checked");
    return `- [${checked ? "x" : " "}] `;
  };

  const removeTaskCheckboxes = (listItem: HTMLElement) => {
    const checkboxes = Array.from(listItem.children).filter(
      (child): child is HTMLInputElement =>
        child instanceof HTMLInputElement &&
        child.type.toLowerCase() === "checkbox",
    );
    checkboxes.forEach((checkbox) => {
      const nextSibling = checkbox.nextSibling;
      checkbox.remove();
      if (
        nextSibling &&
        nextSibling.nodeType === Node.TEXT_NODE &&
        (nextSibling.nodeValue ?? "").trim() === ""
      ) {
        nextSibling.remove();
      }
    });
  };

  const resolveListMarker = (listItem: HTMLElement, hint: string | null) => {
    if (hint) {
      return hint;
    }
    const taskMarker = resolveTaskMarker(listItem);
    if (taskMarker) {
      return taskMarker;
    }
    const parent = listItem.parentElement;
    if (parent?.tagName.toLowerCase() === "ol") {
      return resolveOrderedMarker(listItem);
    }
    return "- ";
  };
  const listMarkerHints = parseListMarkersFromMarkdown(rawMarkdown ?? "");
  const codeFenceHints = parseCodeFenceMarkersFromMarkdown(rawMarkdown ?? "");
  let listMarkerHintIndex = 0;
  let codeFenceHintIndex = 0;

  const createCodeCopyButton = (doc: Document) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "md-code-copy-button";
    button.setAttribute("aria-label", "Copy code block");
    button.setAttribute("title", "Copy code block");
    button.setAttribute("contenteditable", "false");
    button.setAttribute("tabindex", "-1");

    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");

    const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "9");
    rect.setAttribute("y", "9");
    rect.setAttribute("width", "10");
    rect.setAttribute("height", "10");
    rect.setAttribute("rx", "2");
    rect.setAttribute("stroke", "currentColor");
    rect.setAttribute("stroke-width", "1.7");

    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.7");
    path.setAttribute("stroke-linecap", "round");

    svg.appendChild(rect);
    svg.appendChild(path);
    button.appendChild(svg);
    return button;
  };

  clone.querySelectorAll(".frontmatter-panel").forEach((panel) => panel.remove());
  clone.querySelectorAll(".md-code-copy-button").forEach((button) => button.remove());
  clone.querySelectorAll<HTMLElement>("pre").forEach((codeBlock) => {
    let wrapper = codeBlock.parentElement;
    if (!wrapper || !wrapper.classList.contains("md-code-block")) {
      const createdWrapper = codeBlock.ownerDocument.createElement("div");
      createdWrapper.className = "md-code-block";
      codeBlock.replaceWith(createdWrapper);
      createdWrapper.appendChild(codeBlock);
      wrapper = createdWrapper;
    }
    wrapper.insertBefore(createCodeCopyButton(codeBlock.ownerDocument), wrapper.firstChild);

    codeBlock.setAttribute("data-md-code-block", "true");
    codeBlock.removeAttribute("data-md-code-active");
    if (codeBlock.querySelector(".md-code-fence-line")) {
      return;
    }
    const markerHint = codeFenceHints[codeFenceHintIndex] ?? null;
    codeFenceHintIndex += 1;
    const openMarkerText = markerHint?.open ?? "```";
    const closeMarkerText = markerHint?.close ?? "```";
    const openLine = codeBlock.ownerDocument.createElement("span");
    openLine.className = "md-code-fence-line md-code-fence-open";
    const openMarker = codeBlock.ownerDocument.createElement("span");
    openMarker.className = "md-code-fence-marker";
    openMarker.textContent = openMarkerText;
    openLine.appendChild(openMarker);
    codeBlock.insertBefore(openLine, codeBlock.firstChild);

    const closeLine = codeBlock.ownerDocument.createElement("span");
    closeLine.className = "md-code-fence-line md-code-fence-close";
    const closeMarker = codeBlock.ownerDocument.createElement("span");
    closeMarker.className = "md-code-fence-marker";
    closeMarker.textContent = closeMarkerText;
    closeLine.appendChild(closeMarker);
    codeBlock.appendChild(closeLine);
  });
  clone.querySelectorAll<HTMLElement>("li").forEach((item) => {
    if (
      item.firstElementChild instanceof HTMLElement &&
      item.firstElementChild.classList.contains("md-list-marker")
    ) {
      return;
    }
    const markerHint = listMarkerHints[listMarkerHintIndex] ?? null;
    listMarkerHintIndex += 1;
    const markerText = resolveListMarker(item, markerHint);
    removeTaskCheckboxes(item);
    const marker = item.ownerDocument.createElement("span");
    marker.className = "md-list-marker";
    marker.textContent = markerText;
    item.insertBefore(marker, item.firstChild);
  });
  clone.querySelectorAll<HTMLElement>("hr").forEach((rule) => {
    const markerLine = rule.ownerDocument.createElement("p");
    markerLine.setAttribute("data-md-hr-line", "true");
    const marker = rule.ownerDocument.createElement("span");
    marker.className = "md-hr-marker";
    marker.textContent = "---";
    markerLine.appendChild(marker);
    rule.replaceWith(markerLine);
  });
  clone.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((heading) => {
    const levelRaw = Number.parseInt(heading.tagName.slice(1), 10);
    if (Number.isNaN(levelRaw)) {
      return;
    }
    const level = Math.max(1, Math.min(6, levelRaw));
    heading.setAttribute("data-md-heading-level", String(level));
    const text = heading.textContent ?? "";
    if (/^\s*\\?#{1,6}(?:\s|$)/.test(text)) {
      return;
    }
    const marker = heading.ownerDocument.createElement("span");
    marker.className = "md-heading-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = `${"#".repeat(level)} `;
    heading.insertBefore(marker, heading.firstChild);
  });
  return clone.innerHTML;
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
  options?: MarkdownOffsetMapOptions,
) => {
  const resolvedRange = range ?? getSelectionRange(container);
  if (!resolvedRange) {
    return null;
  }
  const plainOffset = getRangeOffset(container, resolvedRange);
  if (rawMarkdown.length === 0) {
    return 0;
  }
  return mapPlainOffsetToRawIndex(rawMarkdown, plainOffset, options);
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
    expanded = expanded.replace(/\s#(?![A-Za-z0-9_])\s*/g, "\n#\n");
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

const FrontmatterTextIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 6h12" />
    <path d="M6 12h12" />
    <path d="M6 18h8" />
  </svg>
);

const FrontmatterNumberIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 5L6 19" />
    <path d="M16 5l-2 14" />
    <path d="M4 10h16" />
    <path d="M3 15h16" />
  </svg>
);

const FrontmatterToggleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <circle cx="9" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

const FrontmatterTagIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 13l-7 7-9-9V4h7l9 9z" />
    <circle cx="8.5" cy="8.5" r="1.4" />
  </svg>
);

const FrontmatterLinkIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
    <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
  </svg>
);

const FrontmatterImageIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M3 16l5-4 4 3 3-2 6 5" />
  </svg>
);

const FrontmatterUnknownIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.4 2.4 0 0 1 4.8 0c0 1.4-1.5 1.9-2.3 2.5-.5.3-.7.7-.7 1.3" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const FrontmatterGripIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <circle cx="8" cy="7" r="1.2" />
    <circle cx="8" cy="12" r="1.2" />
    <circle cx="8" cy="17" r="1.2" />
    <circle cx="16" cy="7" r="1.2" />
    <circle cx="16" cy="12" r="1.2" />
    <circle cx="16" cy="17" r="1.2" />
  </svg>
);

const FrontmatterPropertyIconView = ({
  icon,
}: {
  icon: FrontmatterPropertyIcon;
}) => {
  switch (icon) {
    case "cover":
      return <FrontmatterImageIcon />;
    case "number":
      return <FrontmatterNumberIcon />;
    case "boolean":
      return <FrontmatterToggleIcon />;
    case "tags":
      return <FrontmatterTagIcon />;
    case "link":
      return <FrontmatterLinkIcon />;
    case "unknown":
      return <FrontmatterUnknownIcon />;
    default:
      return <FrontmatterTextIcon />;
  }
};

const stringifyPropertyValue = (property: FrontmatterProperty) => {
  if (Array.isArray(property.value)) {
    return property.value.join(", ");
  }
  if (typeof property.value === "number") {
    return String(property.value);
  }
  if (typeof property.value === "boolean") {
    return property.value ? "true" : "false";
  }
  return property.value ?? "";
};

const normalizeTags = (value: string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((tag) => {
    const clean = tag.trim();
    if (!clean || seen.has(clean)) {
      return;
    }
    seen.add(clean);
    normalized.push(clean);
  });
  return normalized;
};

type FrontmatterEditorMode = "idle" | "active" | "editing" | "committing";

const numericSuggestionPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

const isNumericSuggestionValue = (value: string) =>
  numericSuggestionPattern.test(value.trim());

const sortSuggestionValues = (values: string[]) => {
  const allNumeric = values.length > 0 && values.every(isNumericSuggestionValue);
  const sorted = values.slice();
  if (allNumeric) {
    sorted.sort((left, right) => Number(left) - Number(right));
    return sorted;
  }
  sorted.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  return sorted;
};

const mergeSuggestionRecords = (...sources: Array<Record<string, string[]>>) => {
  const buckets = new Map<string, Set<string>>();
  sources.forEach((source) => {
    Object.entries(source).forEach(([key, values]) => {
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = new Set<string>();
        buckets.set(key, bucket);
      }
      values.forEach((value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return;
        }
        bucket?.add(trimmed);
      });
    });
  });
  const merged: Record<string, string[]> = {};
  Array.from(buckets.entries()).forEach(([key, values]) => {
    merged[key] = sortSuggestionValues(Array.from(values));
  });
  return merged;
};

const mergeSuggestionKeyLists = (...sources: string[][]) => {
  const seen = new Set<string>();
  const merged: string[] = [];
  sources.forEach((source) => {
    source.forEach((key) => {
      const trimmed = key.trim();
      if (!trimmed || seen.has(trimmed)) {
        return;
      }
      seen.add(trimmed);
      merged.push(trimmed);
    });
  });
  return merged;
};

type FrontmatterAddPropertyType = "text" | "link" | "number" | "cover" | "tags";

type FrontmatterAddTypeOption = {
  kind: FrontmatterAddPropertyType;
  icon: FrontmatterPropertyIcon;
  label: string;
  description: string;
};

const FRONTMATTER_DEFAULT_ADD_TYPE: FrontmatterAddPropertyType = "text";

const FRONTMATTER_ADD_TYPE_OPTIONS: FrontmatterAddTypeOption[] = [
  {
    kind: "text",
    icon: "text",
    label: "Text",
    description: "Freier Text",
  },
  {
    kind: "link",
    icon: "link",
    label: "Links",
    description: "Wikilink oder Name",
  },
  {
    kind: "number",
    icon: "number",
    label: "Nur Zahlen",
    description: "Nur numerische Werte",
  },
  {
    kind: "cover",
    icon: "cover",
    label: "Cover",
    description: "Bild-Wikilink",
  },
  {
    kind: "tags",
    icon: "tags",
    label: "Tags",
    description: "Tag-Liste",
  },
];

const addTypeSuggestionScope = "__frontmatter_add_type__";
const addKeySuggestionScope = "__frontmatter_add_key__";
const addValueSuggestionScope = "__frontmatter_add_value__";

const resolveAutoAddKeyForType = (kind: FrontmatterAddPropertyType) => {
  if (kind === "link") {
    return "links";
  }
  if (kind === "tags") {
    return "tags";
  }
  return null;
};

const isReservedTextSuggestionKey = (key: string) => {
  const normalized = key.trim().toLowerCase();
  return isLinkPropertyKey(key) || normalized === "tags" || normalized === "tag";
};

const imageSuggestionExtensionPattern = /\.(png|jpe?g|webp|gif|svg)$/i;

const isImageSuggestionValue = (value: string) => {
  const normalized = normalizeWikilinkValue(value);
  if (!normalized.startsWith("[[") || !normalized.endsWith("]]")) {
    return false;
  }
  const inner = normalized.slice(2, -2);
  const [targetRaw] = inner.split("|");
  const target = targetRaw?.trim() ?? "";
  if (!target) {
    return false;
  }
  const [pathPart] = target.split(/[?#]/);
  return imageSuggestionExtensionPattern.test(pathPart ?? "");
};

const normalizeStableSuggestions = (values: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    next.push(trimmed);
  });
  return next;
};

const isScalarEditableKind = (kind: FrontmatterPropertyKind) =>
  kind === "text" ||
  kind === "unknown" ||
  kind === "link" ||
  kind === "cover" ||
  kind === "number";

const isPrintableCharacterKey = (
  event: Pick<KeyboardEvent<HTMLInputElement>, "key" | "metaKey" | "ctrlKey" | "altKey">,
) =>
  event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;

const resolveSuggestionValuesFromCommitted = (
  value: string | number | boolean | string[] | null,
) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? [String(value)] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "true" : "false"];
  }
  return [];
};

const resolveWikilinkLabel = (wikilink: string) => {
  const trimmed = wikilink.trim();
  if (!trimmed.startsWith("[[") || !trimmed.endsWith("]]")) {
    return trimmed;
  }
  const inner = trimmed.slice(2, -2).trim();
  if (!inner) {
    return trimmed;
  }
  const [targetRaw, aliasRaw] = inner.split("|");
  const alias = aliasRaw?.trim();
  if (alias) {
    return alias;
  }
  return targetRaw?.trim() ?? trimmed;
};

type FrontmatterPropertiesPanelProps = {
  sourceMarkdown: string;
  properties: FrontmatterProperty[];
  canEdit: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onFrontmatterSave?: (nextPreview: string) => Promise<boolean>;
  onNavigateWikilink?: (wikilink: string) => void;
  valueSuggestionsByKey?: Record<string, string[]>;
  keySuggestions?: string[];
};

const EMPTY_VALUE_SUGGESTIONS: Record<string, string[]> = {};
const EMPTY_KEY_SUGGESTIONS: string[] = [];

const FrontmatterPropertiesPanel = ({
  sourceMarkdown,
  properties,
  canEdit,
  isCollapsed,
  onToggleCollapsed,
  onFrontmatterSave,
  onNavigateWikilink,
  valueSuggestionsByKey = EMPTY_VALUE_SUGGESTIONS,
  keySuggestions = EMPTY_KEY_SUGGESTIONS,
}: FrontmatterPropertiesPanelProps) => {
  const linksDocument = useMemo(
    () => parseFrontmatterLinks(sourceMarkdown),
    [sourceMarkdown],
  );
  const visibleProperties = useMemo(
    () => properties.filter((property) => !isLinkPropertyKey(property.key)),
    [properties],
  );
  const initialDrafts = useMemo(() => {
    const next: Record<string, string> = {};
    visibleProperties.forEach((property) => {
      next[property.key] = stringifyPropertyValue(property);
    });
    return next;
  }, [visibleProperties]);
  const initialSuggestionValues = useMemo(
    () =>
      mergeSuggestionRecords(
        valueSuggestionsByKey,
        collectFrontmatterValueSuggestions(visibleProperties),
      ),
    [valueSuggestionsByKey, visibleProperties],
  );
  const initialKeySuggestions = useMemo(
    () => mergeSuggestionKeyLists(keySuggestions),
    [keySuggestions],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(initialDrafts);
  const [suggestionValuesByKey, setSuggestionValuesByKey] = useState<Record<string, string[]>>(
    initialSuggestionValues,
  );
  const [suggestionKeys, setSuggestionKeys] = useState<string[]>(
    initialKeySuggestions,
  );
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [panelError, setPanelError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [linksInputDraft, setLinksInputDraft] = useState("");
  const [addTypeDraft, setAddTypeDraft] = useState<FrontmatterAddPropertyType>(
    FRONTMATTER_DEFAULT_ADD_TYPE,
  );
  const [addKeyDraft, setAddKeyDraft] = useState("");
  const [addValueDraft, setAddValueDraft] = useState("");
  const [addError, setAddError] = useState("");
  const [addEditorModes, setAddEditorModes] = useState<{
    type: FrontmatterEditorMode;
    key: FrontmatterEditorMode;
    value: FrontmatterEditorMode;
  }>({
    type: "idle",
    key: "idle",
    value: "idle",
  });
  const [editorModes, setEditorModes] = useState<Record<string, FrontmatterEditorMode>>({});
  const [openSuggestionsKey, setOpenSuggestionsKey] = useState<string | null>(null);
  const [suggestionCursor, setSuggestionCursor] = useState<Record<string, number>>({});
  const valueInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const linksInputRef = useRef<HTMLInputElement | null>(null);
  const addTypeButtonRef = useRef<HTMLButtonElement | null>(null);
  const addKeyInputRef = useRef<HTMLInputElement | null>(null);
  const addValueInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFrameHandlesRef = useRef<Set<number>>(new Set());
  const [dragPropertyKey, setDragPropertyKey] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    key: string;
    position: "before" | "after";
  } | null>(null);
  const existingPropertyKeys = useMemo(
    () => new Set(properties.map((property) => property.key.toLowerCase())),
    [properties],
  );
  const hasExistingLinkAttributes = useMemo(
    () => properties.some((property) => isLinkPropertyKey(property.key)),
    [properties],
  );
  const hasExistingTagsAttribute = useMemo(
    () => properties.some((property) => property.key.trim().toLowerCase() === "tags"),
    [properties],
  );
  const addTypeOptions = useMemo(
    () =>
      FRONTMATTER_ADD_TYPE_OPTIONS.filter((option) => {
        if (option.kind === "link" && hasExistingLinkAttributes) {
          return false;
        }
        if (option.kind === "tags" && hasExistingTagsAttribute) {
          return false;
        }
        return true;
      }),
    [hasExistingLinkAttributes, hasExistingTagsAttribute],
  );

  useEffect(() => {
    setDrafts(initialDrafts);
    setEditorModes({});
    setAddEditorModes({ type: "idle", key: "idle", value: "idle" });
    setOpenSuggestionsKey(null);
    setSuggestionCursor({});
    setTagInputs({});
    setRowErrors({});
    setPanelError("");
    setDragPropertyKey(null);
    setDropHint(null);
  }, [initialDrafts]);

  useEffect(() => {
    setSuggestionValuesByKey(initialSuggestionValues);
  }, [initialSuggestionValues]);

  useEffect(() => {
    setSuggestionKeys(initialKeySuggestions);
  }, [initialKeySuggestions]);

  useEffect(() => {
    if (addTypeOptions.some((option) => option.kind === addTypeDraft)) {
      return;
    }
    setAddTypeDraft(FRONTMATTER_DEFAULT_ADD_TYPE);
  }, [addTypeDraft, addTypeOptions]);

  const scheduleAnimationFrame = useCallback((callback: () => void) => {
    const handle = window.requestAnimationFrame(() => {
      pendingFrameHandlesRef.current.delete(handle);
      callback();
    });
    pendingFrameHandlesRef.current.add(handle);
    return handle;
  }, []);

  useEffect(() => {
    return () => {
      pendingFrameHandlesRef.current.forEach((handle) => {
        window.cancelAnimationFrame(handle);
      });
      pendingFrameHandlesRef.current.clear();
    };
  }, []);

  const resetDraftsFromProperties = useCallback(() => {
    setDrafts(initialDrafts);
    setEditorModes({});
    setAddEditorModes({ type: "idle", key: "idle", value: "idle" });
    setOpenSuggestionsKey(null);
    setSuggestionCursor({});
    setTagInputs({});
    setRowErrors({});
  }, [initialDrafts]);

  const saveBusy = savingKey !== null;
  const controlsDisabled = !canEdit || saveBusy;
  const hasLinksRow =
    linksDocument.links.length > 0 ||
    properties.some((property) => isLinkPropertyKey(property.key));
  const collapsedAttributeCount = visibleProperties.length + (hasLinksRow ? 1 : 0);

  const updateSuggestionCache = useCallback((key: string, values: string[]) => {
    if (values.length === 0) {
      return;
    }
    setSuggestionValuesByKey((current) =>
      mergeSuggestionRecords(current, { [key]: values }),
    );
  }, []);

  const updateKeySuggestionCache = useCallback((keys: string[]) => {
    if (keys.length === 0) {
      return;
    }
    setSuggestionKeys((current) => mergeSuggestionKeyLists(current, keys));
  }, []);

  const resolveSuggestionsForKey = useCallback(
    (key: string, rawInput: string) => {
      const source = suggestionValuesByKey[key] ?? [];
      if (source.length === 0) {
        return [];
      }
      const query = rawInput.trim().toLowerCase();
      if (!query) {
        return source;
      }
      return source.filter((value) => value.toLowerCase().includes(query));
    },
    [suggestionValuesByKey],
  );

  const resolveValueSuggestionsForAddKey = useCallback(
    (rawKey: string) => {
      const key = rawKey.trim();
      if (!key) {
        return [];
      }
      if (suggestionValuesByKey[key]) {
        return suggestionValuesByKey[key] ?? [];
      }
      const normalizedKey = key.toLowerCase();
      const resolvedKey = Object.keys(suggestionValuesByKey).find(
        (candidate) => candidate.toLowerCase() === normalizedKey,
      );
      if (!resolvedKey) {
        return [];
      }
      return suggestionValuesByKey[resolvedKey] ?? [];
    },
    [suggestionValuesByKey],
  );

  const resolveAddKeySuggestions = useCallback(
    (rawInput: string) => {
      if (suggestionKeys.length === 0) {
        return [];
      }
      const query = rawInput.trim().toLowerCase();
      return suggestionKeys.filter((key) => {
        const normalized = key.toLowerCase();
        if (existingPropertyKeys.has(normalized)) {
          return false;
        }
        if (addTypeDraft === "text" && isReservedTextSuggestionKey(key)) {
          return false;
        }
        if (!query) {
          return true;
        }
        return normalized.includes(query);
      });
    },
    [addTypeDraft, existingPropertyKeys, suggestionKeys],
  );

  const resolveAddValueSuggestions = useCallback(
    ({
      key,
      kind,
      rawInput,
    }: {
      key: string;
      kind: FrontmatterAddPropertyType;
      rawInput: string;
    }) => {
      const rawSource = resolveValueSuggestionsForAddKey(key);
      if (rawSource.length === 0) {
        return [];
      }
      let source = normalizeStableSuggestions(rawSource);
      if (kind === "number") {
        source = sortSuggestionValues(source.filter(isNumericSuggestionValue));
      } else if (kind === "link") {
        source = sortSuggestionValues(
          normalizeStableSuggestions(source.map((value) => normalizeWikilinkValue(value))),
        );
      } else if (kind === "cover") {
        source = sortSuggestionValues(
          normalizeStableSuggestions(
            source
              .map((value) => normalizeWikilinkValue(value))
              .filter((value) => isImageSuggestionValue(value)),
          ),
        );
      } else {
        source = sortSuggestionValues(source);
      }
      if (source.length === 0) {
        return [];
      }
      const query = rawInput.trim().toLowerCase();
      if (!query) {
        return source;
      }
      return source.filter((value) => value.toLowerCase().includes(query));
    },
    [resolveValueSuggestionsForAddKey],
  );

  const activateEditor = useCallback((key: string) => {
    setEditorModes((current) => ({
      ...current,
      [key]: current[key] === "editing" || current[key] === "committing" ? current[key] : "active",
    }));
  }, []);

  const beginEditing = useCallback((key: string) => {
    setEditorModes((current) => ({
      ...current,
      [key]: "editing",
    }));
  }, []);

  const activateAddInput = useCallback((field: "type" | "key" | "value") => {
    setAddEditorModes((current) => ({
      ...current,
      [field]:
        current[field] === "editing" || current[field] === "committing"
          ? current[field]
          : "active",
    }));
  }, []);

  const beginAddEditing = useCallback((field: "type" | "key" | "value") => {
    setAddEditorModes((current) => ({
      ...current,
      [field]: "editing",
    }));
  }, []);

  const commitPropertyChange = useCallback(
    async ({
      property,
      kind,
      value,
    }: {
      property: FrontmatterProperty;
      kind: FrontmatterPropertyKind;
      value: string | number | boolean | string[] | null;
    }): Promise<boolean> => {
      if (!onFrontmatterSave || !canEdit || saveBusy) {
        return false;
      }
      const updated = updateFrontmatterProperty({
        markdown: sourceMarkdown,
        key: property.key,
        kind,
        value,
      });
      if (updated.error) {
        setPanelError(updated.error);
        resetDraftsFromProperties();
        return false;
      }

      setPanelError("");
      setSavingKey(property.key);
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
        resetDraftsFromProperties();
        return false;
      }
      updateSuggestionCache(property.key, resolveSuggestionValuesFromCommitted(value));
      return true;
    },
    [
      canEdit,
      onFrontmatterSave,
      resetDraftsFromProperties,
      saveBusy,
      sourceMarkdown,
      updateSuggestionCache,
    ],
  );

  const commitLinksChange = useCallback(
    async (links: string[]) => {
      if (controlsDisabled || !onFrontmatterSave) {
        return false;
      }
      const updated = updateFrontmatterLinks({
        markdown: sourceMarkdown,
        links,
      });
      if (updated.error) {
        setPanelError(updated.error);
        return false;
      }
      setPanelError("");
      setSavingKey("__links__");
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      }
      return saved;
    },
    [controlsDisabled, onFrontmatterSave, sourceMarkdown],
  );

  const handleAddLink = useCallback(async (rawInput?: string) => {
    if (controlsDisabled) {
      return;
    }
    const normalized = normalizeWikilinkValue(
      rawInput ?? linksInputRef.current?.value ?? linksInputDraft,
    );
    if (!normalized) {
      return;
    }
    if (linksDocument.links.includes(normalized)) {
      setLinksInputDraft("");
      return;
    }
    const saved = await commitLinksChange([...linksDocument.links, normalized]);
    if (saved) {
      setLinksInputDraft("");
    }
  }, [commitLinksChange, controlsDisabled, linksDocument.links, linksInputDraft]);

  const handleRemoveLink = useCallback(
    (link: string) => {
      if (controlsDisabled) {
        return;
      }
      void commitLinksChange(linksDocument.links.filter((item) => item !== link));
    },
    [commitLinksChange, controlsDisabled, linksDocument.links],
  );

  const resolveSuggestionValuesFromAddedDraft = useCallback(
    ({
      kind,
      value,
    }: {
      kind: FrontmatterAddPropertyType;
      value: string;
    }) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }
      if (kind === "number") {
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? [String(parsed)] : [];
      }
      if (kind === "link" || kind === "cover") {
        const normalized = normalizeWikilinkValue(trimmed);
        return normalized ? [normalized] : [];
      }
      if (kind === "tags") {
        return normalizeTags(
          value
            .split(/[\n,]/)
            .map((tag) => tag.trim())
            .filter((tag) => tag !== ""),
        );
      }
      return [trimmed];
    },
    [],
  );

  const setAddTypeSelection = useCallback(
    (kind: FrontmatterAddPropertyType) => {
      const autoKey = resolveAutoAddKeyForType(kind);
      setAddTypeDraft(kind);
      setOpenSuggestionsKey(null);
      setAddEditorModes((current) => ({
        ...current,
        type: "active",
        key: autoKey ? "idle" : current.key,
      }));
      if (addError) {
        setAddError("");
      }
      scheduleAnimationFrame(() => {
        if (autoKey) {
          addValueInputRef.current?.focus();
          return;
        }
        addKeyInputRef.current?.focus();
      });
    },
    [addError, scheduleAnimationFrame],
  );

  const handleAddProperty = useCallback(async () => {
    if (controlsDisabled || !onFrontmatterSave) {
      return;
    }
    const autoKey = resolveAutoAddKeyForType(addTypeDraft);
    const keyFromState = (autoKey ?? addKeyDraft).trim();
    const keyFromDom = (autoKey ?? (addKeyInputRef.current?.value ?? "")).trim();
    const nextKey = keyFromState || keyFromDom;
    const nextValue = addValueInputRef.current
      ? addValueInputRef.current.value
      : addValueDraft;
    if (!autoKey && keyFromDom && keyFromDom !== addKeyDraft) {
      setAddKeyDraft(keyFromDom);
    }
    if (nextValue !== addValueDraft) {
      setAddValueDraft(nextValue);
    }
    if (!nextKey) {
      setAddError("Bitte einen Attribut-Namen angeben.");
      return;
    }
    if (nextKey.includes(":")) {
      setAddError("Attribut-Name darf kein ':' enthalten.");
      return;
    }
    if (addTypeDraft === "link") {
      const hasLinks = properties.some((property) => isLinkPropertyKey(property.key));
      if (hasLinks) {
        setAddError("Links existiert bereits.");
        return;
      }
    }
    if (addTypeDraft === "tags") {
      const hasTags = properties.some((property) => property.key.trim().toLowerCase() === "tags");
      if (hasTags) {
        setAddError("Tags existiert bereits.");
        return;
      }
    }

    const duplicate = properties.some((property) => property.key === nextKey);
    if (duplicate) {
      setAddError(`Attribut "${nextKey}" existiert bereits.`);
      return;
    }
    const updated = addFrontmatterProperty({
      markdown: sourceMarkdown,
      key: nextKey,
      value: nextValue,
      kind: addTypeDraft,
    });
    if (updated.error) {
      setAddError(updated.error);
      return;
    }

    setAddError("");
    setPanelError("");
    setSavingKey("__add__");
    let saved = false;
    try {
      saved = await onFrontmatterSave(updated.markdown);
    } catch {
      saved = false;
    } finally {
      setSavingKey(null);
    }
    if (!saved) {
      setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      return;
    }
    updateKeySuggestionCache([nextKey]);
    const normalizedValues = resolveSuggestionValuesFromAddedDraft({
      kind: addTypeDraft,
      value: nextValue,
    });
    if (normalizedValues.length > 0) {
      updateSuggestionCache(nextKey, normalizedValues);
    }
    setAddTypeDraft(FRONTMATTER_DEFAULT_ADD_TYPE);
    setAddKeyDraft("");
    setAddValueDraft("");
    setAddEditorModes({ type: "idle", key: "idle", value: "idle" });
    setOpenSuggestionsKey(null);
    setSuggestionCursor((current) => ({
      ...current,
      [addTypeSuggestionScope]: 0,
      [addKeySuggestionScope]: 0,
      [addValueSuggestionScope]: 0,
    }));
  }, [
    addTypeDraft,
    addKeyDraft,
    addValueDraft,
    controlsDisabled,
    addKeyInputRef,
    addValueInputRef,
    onFrontmatterSave,
    properties,
    sourceMarkdown,
    updateKeySuggestionCache,
    updateSuggestionCache,
    resolveSuggestionValuesFromAddedDraft,
  ]);

  const resolveDropPosition = useCallback(
    (event: Pick<DragEvent<HTMLDivElement>, "currentTarget" | "clientY">) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      return event.clientY > midpoint ? "after" : "before";
    },
    [],
  );

  const commitReorder = useCallback(
    async ({
      fromKey,
      toKey,
      position,
    }: {
      fromKey: string;
      toKey: string;
      position: "before" | "after";
    }) => {
      if (controlsDisabled || !onFrontmatterSave) {
        return;
      }
      if (fromKey === toKey) {
        return;
      }
      const updated = reorderFrontmatterProperties({
        markdown: sourceMarkdown,
        fromKey,
        toKey,
        position,
      });
      if (updated.error) {
        setPanelError(updated.error);
        return;
      }
      setPanelError("");
      setSavingKey("__reorder__");
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      }
    },
    [controlsDisabled, onFrontmatterSave, sourceMarkdown],
  );

  const commitRemoveProperty = useCallback(
    async (key: string) => {
      if (controlsDisabled || !onFrontmatterSave) {
        return false;
      }
      const updated = removeFrontmatterProperty({
        markdown: sourceMarkdown,
        key,
      });
      if (updated.error) {
        setPanelError(updated.error);
        return false;
      }
      setPanelError("");
      setSavingKey(key);
      let saved = false;
      try {
        saved = await onFrontmatterSave(updated.markdown);
      } catch {
        saved = false;
      } finally {
        setSavingKey(null);
      }
      if (!saved) {
        setPanelError("Eigenschaften konnten nicht gespeichert werden.");
      }
      return saved;
    },
    [controlsDisabled, onFrontmatterSave, sourceMarkdown],
  );

  const addTypeOption = FRONTMATTER_ADD_TYPE_OPTIONS.find(
    (option) => option.kind === addTypeDraft,
  ) ?? addTypeOptions[0]!;
  const autoManagedAddKey = resolveAutoAddKeyForType(addTypeDraft);
  const isAddKeyAutoManaged = autoManagedAddKey !== null;
  const isAddKeyEditing = addEditorModes.key === "editing";
  const isAddValueEditing = addEditorModes.value === "editing";
  const isAddTypeDropdownOpen =
    openSuggestionsKey === addTypeSuggestionScope &&
    addTypeOptions.length > 0 &&
    !controlsDisabled;
  const addKeySuggestions = isAddKeyAutoManaged
    ? []
    : resolveAddKeySuggestions(isAddKeyEditing ? addKeyDraft : "");
  const selectedAddKey = ((autoManagedAddKey ?? addKeyDraft).trim()) ||
    ((autoManagedAddKey ?? (addKeyInputRef.current?.value ?? "")).trim());
  const addValueSuggestions = resolveAddValueSuggestions({
    key: selectedAddKey,
    kind: addTypeDraft,
    rawInput: isAddValueEditing ? addValueDraft : "",
  });
  const isAddValueEnabled = selectedAddKey.length > 0;
  const isAddKeyDropdownOpen =
    openSuggestionsKey === addKeySuggestionScope &&
    addKeySuggestions.length > 0 &&
    !isAddKeyAutoManaged &&
    !controlsDisabled;
  const isAddValueDropdownOpen =
    openSuggestionsKey === addValueSuggestionScope &&
    addValueSuggestions.length > 0 &&
    !controlsDisabled &&
    isAddValueEnabled;
  const addKeySuggestionListId = "frontmatter-add-key-suggestions";
  const addValueSuggestionListId = "frontmatter-add-value-suggestions";
  const addTypeSuggestionListId = "frontmatter-add-type-suggestions";
  const safeAddTypeSuggestionIndex = Math.max(
    0,
    Math.min(
      suggestionCursor[addTypeSuggestionScope] ?? addTypeOptions.findIndex(
        (option) => option.kind === addTypeDraft,
      ),
      Math.max(0, addTypeOptions.length - 1),
    ),
  );
  const safeAddKeySuggestionIndex = Math.max(
    0,
    Math.min(
      suggestionCursor[addKeySuggestionScope] ?? 0,
      Math.max(0, addKeySuggestions.length - 1),
    ),
  );
  const safeAddValueSuggestionIndex = Math.max(
    0,
    Math.min(
      suggestionCursor[addValueSuggestionScope] ?? 0,
      Math.max(0, addValueSuggestions.length - 1),
    ),
  );
  const activeAddKeySuggestion = addKeySuggestions[safeAddKeySuggestionIndex] ?? null;
  const activeAddValueSuggestion =
    addValueSuggestions[safeAddValueSuggestionIndex] ?? null;
  const activeAddTypeSuggestion = addTypeOptions[safeAddTypeSuggestionIndex] ?? null;

  return (
    <section className="frontmatter-panel" aria-label="Eigenschaften">
      <div className="frontmatter-header">
        <button
          type="button"
          className="frontmatter-title-button"
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapsed}
        >
          <h3>Eigenschaften</h3>
        </button>
        <div className="frontmatter-header-actions">
          {saveBusy ? <span className="chip">Speichere...</span> : null}
          <button
            type="button"
            className={`ghost small frontmatter-collapse-button ${isCollapsed ? "collapsed" : ""}`}
            aria-label={isCollapsed ? "Eigenschaften aufklappen" : "Eigenschaften einklappen"}
            aria-expanded={!isCollapsed}
            onClick={onToggleCollapsed}
          >
            <span className="frontmatter-collapse-icon" aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </button>
        </div>
      </div>
      {!isCollapsed ? (
        <>
          <div className="frontmatter-grid" role="table" aria-label="Frontmatter properties">
            {visibleProperties.map((property) => {
              const isRowSaving = savingKey === property.key;
              const rowDisabled = controlsDisabled || isRowSaving;
              const tags = Array.isArray(property.value) ? property.value : [];
              const rowError = rowErrors[property.key] ?? "";
              const editorMode = editorModes[property.key] ?? "idle";
              const isEditorEditing = editorMode === "editing";
              const suggestions = resolveSuggestionsForKey(
                property.key,
                drafts[property.key] ?? "",
              );
              const suggestionListId = `frontmatter-suggestions-${property.key
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, "-")}`;
              const safeSuggestionIndex = Math.max(
                0,
                Math.min(suggestionCursor[property.key] ?? 0, Math.max(0, suggestions.length - 1)),
              );
              const activeSuggestion = suggestions[safeSuggestionIndex] ?? null;
              const isDropdownOpen = openSuggestionsKey === property.key &&
                suggestions.length > 0 &&
                !rowDisabled &&
                isScalarEditableKind(property.kind);

              const commitScalarDraft = async (rawInput: string) => {
                if (property.kind === "number") {
                  const value = rawInput.trim();
                  if (!value) {
                    setRowErrors((current) => ({ ...current, [property.key]: "" }));
                    return commitPropertyChange({
                      property,
                      kind: "number",
                      value: null,
                    });
                  }
                  const parsed = Number(value);
                  if (!Number.isFinite(parsed)) {
                    setRowErrors((current) => ({
                      ...current,
                      [property.key]: "Bitte eine gueltige Zahl eingeben.",
                    }));
                    return false;
                  }
                  setRowErrors((current) => ({ ...current, [property.key]: "" }));
                  return commitPropertyChange({
                    property,
                    kind: "number",
                    value: parsed,
                  });
                }
                const nextValue = property.kind === "link" || property.kind === "cover"
                  ? normalizeWikilinkValue(rawInput)
                  : rawInput;
                setDrafts((current) => ({
                  ...current,
                  [property.key]: nextValue,
                }));
                return commitPropertyChange({
                  property,
                  kind: property.kind,
                  value: nextValue.trim() === "" ? null : nextValue,
                });
              };

              const renderValueEditor = () => {
                switch (property.kind) {
                  case "boolean":
                    return (
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={property.value === true}
                          disabled={rowDisabled}
                          aria-label={`${property.key} value`}
                          onChange={(event) => {
                            void commitPropertyChange({
                              property,
                              kind: "boolean",
                              value: event.target.checked,
                            });
                          }}
                        />
                        <span className="slider" />
                      </label>
                    );
                  case "tags":
                    return (
                      <div className="frontmatter-tags-editor">
                        {tags.length > 0 ? (
                          <div className="frontmatter-tag-list">
                            {tags.map((tag, tagIndex) => (
                              <span
                                key={`${property.key}-${tag}-${tagIndex}`}
                                className="frontmatter-tag-chip"
                              >
                                <span>{tag}</span>
                                <button
                                  type="button"
                                  className="frontmatter-tag-remove"
                                  onClick={() => {
                                    const nextTags = tags.filter((item) => item !== tag);
                                    void commitPropertyChange({
                                      property,
                                      kind: "tags",
                                      value: nextTags,
                                    });
                                  }}
                                  disabled={rowDisabled}
                                  aria-label={`${tag} entfernen`}
                                >
                                  x
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="frontmatter-empty-value">Kein Wert</span>
                        )}
                        <input
                          type="text"
                          className="text-input frontmatter-input"
                          placeholder="Tag hinzufuegen"
                          aria-label={`${property.key} add tag`}
                          value={tagInputs[property.key] ?? ""}
                          disabled={rowDisabled}
                          onChange={(event) => {
                            const next = event.target.value;
                            setTagInputs((current) => ({ ...current, [property.key]: next }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") {
                              return;
                            }
                            event.preventDefault();
                            const value = (tagInputs[property.key] ?? "").trim();
                            if (!value) {
                              return;
                            }
                            const nextTags = normalizeTags([...tags, value]);
                            setTagInputs((current) => ({ ...current, [property.key]: "" }));
                            void commitPropertyChange({
                              property,
                              kind: "tags",
                              value: nextTags,
                            });
                          }}
                        />
                      </div>
                    );
                  case "number":
                  case "link":
                  case "cover":
                  case "unknown":
                  case "text":
                  default:
                    return (
                      <div className="frontmatter-input-wrap">
                        <input
                          type="text"
                          inputMode={property.kind === "number" ? "decimal" : undefined}
                          className="text-input frontmatter-input"
                          placeholder="Kein Wert"
                          aria-label={`${property.key} value`}
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={isDropdownOpen}
                          aria-controls={isDropdownOpen ? suggestionListId : undefined}
                          value={drafts[property.key] ?? ""}
                          readOnly={!isEditorEditing}
                          disabled={rowDisabled}
                          onChange={(event) => {
                            if (!isEditorEditing) {
                              return;
                            }
                            const next = event.target.value;
                            setDrafts((current) => ({ ...current, [property.key]: next }));
                            if (rowErrors[property.key]) {
                              setRowErrors((current) => ({ ...current, [property.key]: "" }));
                            }
                            setOpenSuggestionsKey(property.key);
                            setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                          }}
                          onFocus={() => {
                            if (rowDisabled) {
                              return;
                            }
                            activateEditor(property.key);
                            setOpenSuggestionsKey(property.key);
                            setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                          }}
                          onClick={() => {
                            if (rowDisabled) {
                              return;
                            }
                            activateEditor(property.key);
                            setOpenSuggestionsKey(property.key);
                          }}
                          onDoubleClick={() => {
                            if (rowDisabled) {
                              return;
                            }
                            beginEditing(property.key);
                            setOpenSuggestionsKey(property.key);
                          }}
                          onBlur={(event) => {
                            setOpenSuggestionsKey((current) =>
                              current === property.key ? null : current
                            );
                            const mode = editorModes[property.key] ?? "idle";
                            if (mode !== "editing") {
                              setEditorModes((current) => ({ ...current, [property.key]: "idle" }));
                              setDrafts((current) => ({
                                ...current,
                                [property.key]: stringifyPropertyValue(property),
                              }));
                              return;
                            }
                            const raw = event.currentTarget.value;
                            setEditorModes((current) => ({
                              ...current,
                              [property.key]: "committing",
                            }));
                            void (async () => {
                              const saved = await commitScalarDraft(raw);
                              setEditorModes((current) => ({
                                ...current,
                                [property.key]: saved ? "idle" : "editing",
                              }));
                            })();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "F2") {
                              event.preventDefault();
                              beginEditing(property.key);
                              setOpenSuggestionsKey(property.key);
                              return;
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setOpenSuggestionsKey((current) =>
                                current === property.key ? null : current
                              );
                              setEditorModes((current) => ({ ...current, [property.key]: "idle" }));
                              setDrafts((current) => ({
                                ...current,
                                [property.key]: stringifyPropertyValue(property),
                              }));
                              event.currentTarget.blur();
                              return;
                            }
                            if (isDropdownOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                              event.preventDefault();
                              const offset = event.key === "ArrowDown" ? 1 : -1;
                              setSuggestionCursor((current) => {
                                const existing = current[property.key] ?? 0;
                                const next = (existing + offset + suggestions.length) %
                                  suggestions.length;
                                return { ...current, [property.key]: next };
                              });
                              return;
                            }
                            if (event.key === "Enter") {
                              event.preventDefault();
                              if (isDropdownOpen && activeSuggestion) {
                                setDrafts((current) => ({
                                  ...current,
                                  [property.key]: activeSuggestion,
                                }));
                                setOpenSuggestionsKey(null);
                                setEditorModes((current) => ({
                                  ...current,
                                  [property.key]: "committing",
                                }));
                                void (async () => {
                                  const saved = await commitScalarDraft(activeSuggestion);
                                  setEditorModes((current) => ({
                                    ...current,
                                    [property.key]: saved ? "idle" : "editing",
                                  }));
                                })();
                                return;
                              }
                              if (!isEditorEditing && suggestions.length > 0) {
                                const firstSuggestion = suggestions[0] ?? "";
                                if (!firstSuggestion) {
                                  return;
                                }
                                setDrafts((current) => ({
                                  ...current,
                                  [property.key]: firstSuggestion,
                                }));
                                setOpenSuggestionsKey(null);
                                setEditorModes((current) => ({
                                  ...current,
                                  [property.key]: "committing",
                                }));
                                void (async () => {
                                  const saved = await commitScalarDraft(firstSuggestion);
                                  setEditorModes((current) => ({
                                    ...current,
                                    [property.key]: saved ? "idle" : "editing",
                                  }));
                                })();
                                return;
                              }
                              event.currentTarget.blur();
                              return;
                            }
                            if (event.key === "Tab") {
                              setOpenSuggestionsKey((current) =>
                                current === property.key ? null : current
                              );
                              return;
                            }
                            if (!isEditorEditing) {
                              if (isPrintableCharacterKey(event)) {
                                event.preventDefault();
                                const nextValue = `${drafts[property.key] ?? ""}${event.key}`;
                                setDrafts((current) => ({ ...current, [property.key]: nextValue }));
                                beginEditing(property.key);
                                setOpenSuggestionsKey(property.key);
                                setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                                scheduleAnimationFrame(() => {
                                  const input = valueInputRefs.current[property.key];
                                  if (!input) {
                                    return;
                                  }
                                  input.focus();
                                  input.setSelectionRange(nextValue.length, nextValue.length);
                                });
                                return;
                              }
                              if (event.key === "Backspace" || event.key === "Delete") {
                                event.preventDefault();
                                const currentValue = drafts[property.key] ?? "";
                                const nextValue = event.key === "Backspace"
                                  ? currentValue.slice(0, -1)
                                  : "";
                                setDrafts((current) => ({ ...current, [property.key]: nextValue }));
                                beginEditing(property.key);
                                setOpenSuggestionsKey(property.key);
                                setSuggestionCursor((current) => ({ ...current, [property.key]: 0 }));
                              }
                            }
                          }}
                          ref={(element) => {
                            valueInputRefs.current[property.key] = element;
                          }}
                        />
                        {isDropdownOpen ? (
                          <ul
                            id={suggestionListId}
                            className="frontmatter-suggestions"
                            role="listbox"
                            aria-label={`${property.key} Vorschlaege`}
                          >
                            {suggestions.map((suggestion, suggestionIndex) => (
                              <li key={`${property.key}-${suggestion}`}>
                                <button
                                  type="button"
                                  className={`frontmatter-suggestion-option ${
                                    suggestionIndex === safeSuggestionIndex ? "active" : ""
                                  }`}
                                  role="option"
                                  aria-selected={suggestionIndex === safeSuggestionIndex}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                  }}
                                  onClick={() => {
                                    setDrafts((current) => ({
                                      ...current,
                                      [property.key]: suggestion,
                                    }));
                                    setOpenSuggestionsKey(null);
                                    setEditorModes((current) => ({
                                      ...current,
                                      [property.key]: "committing",
                                    }));
                                    void (async () => {
                                      const saved = await commitScalarDraft(suggestion);
                                      setEditorModes((current) => ({
                                        ...current,
                                        [property.key]: saved ? "idle" : "editing",
                                      }));
                                    })();
                                  }}
                                >
                                  {suggestion}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {rowError ? <span className="frontmatter-row-error">{rowError}</span> : null}
                      </div>
                    );
                }
              };

              return (
                <div
                  key={property.key}
                  className={`frontmatter-row ${
                    dragPropertyKey === property.key ? "is-dragging" : ""
                  } ${
                    dropHint?.key === property.key
                      ? dropHint.position === "before"
                        ? "drop-before"
                        : "drop-after"
                      : ""
                  }`.trim()}
                  role="row"
                  data-frontmatter-key={property.key}
                  onDragOver={(event) => {
                    if (controlsDisabled || !dragPropertyKey) {
                      return;
                    }
                    if (dragPropertyKey === property.key) {
                      setDropHint(null);
                      return;
                    }
                    event.preventDefault();
                    const position = resolveDropPosition(event);
                    setDropHint({
                      key: property.key,
                      position,
                    });
                  }}
                  onDrop={(event) => {
                    if (controlsDisabled || !dragPropertyKey) {
                      return;
                    }
                    event.preventDefault();
                    const position = resolveDropPosition(event);
                    const fromKey = dragPropertyKey;
                    setDragPropertyKey(null);
                    setDropHint(null);
                    void commitReorder({
                      fromKey,
                      toKey: property.key,
                      position,
                    });
                  }}
                >
                  <div
                    className={`frontmatter-key ${controlsDisabled ? "" : "is-drag-handle"}`.trim()}
                    role="cell"
                    draggable={!controlsDisabled}
                    onDragStart={(event) => {
                      if (controlsDisabled) {
                        return;
                      }
                      setDragPropertyKey(property.key);
                      if (event.dataTransfer) {
                        event.dataTransfer.effectAllowed = "move";
                        try {
                          event.dataTransfer.setData("text/plain", property.key);
                        } catch {
                          // ignore dataTransfer limitations in certain runtimes
                        }
                      }
                    }}
                    onDragEnd={() => {
                      setDragPropertyKey(null);
                      setDropHint(null);
                    }}
                  >
                    <span className="frontmatter-grip" aria-hidden="true">
                      <FrontmatterGripIcon />
                    </span>
                    <span className="frontmatter-icon" aria-hidden="true">
                      <FrontmatterPropertyIconView icon={property.icon} />
                    </span>
                    <span className="frontmatter-label">{property.key}</span>
                    <button
                      type="button"
                      className="frontmatter-property-remove"
                      disabled={rowDisabled}
                      draggable={false}
                      aria-label={`${property.key} entfernen`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void commitRemoveProperty(property.key);
                      }}
                    >
                      x
                    </button>
                  </div>
                  <div className="frontmatter-value" role="cell">
                    {renderValueEditor()}
                  </div>
                </div>
              );
            })}
            {hasLinksRow ? (
              <div className="frontmatter-row frontmatter-links-row" role="row" data-frontmatter-key="__links__">
                <div className="frontmatter-key" role="cell">
                  <span className="frontmatter-icon" aria-hidden="true">
                    <FrontmatterLinkIcon />
                  </span>
                  <span className="frontmatter-label">Links</span>
                  <button
                    type="button"
                    className="frontmatter-property-remove"
                    disabled={controlsDisabled}
                    draggable={false}
                    aria-label="Links entfernen"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void commitLinksChange([]);
                    }}
                  >
                    x
                  </button>
                </div>
                <div className="frontmatter-value" role="cell">
                  <div className="frontmatter-links-editor">
                    <input
                      ref={linksInputRef}
                      type="text"
                      className="text-input frontmatter-input"
                      placeholder="Link hinzufuegen ..."
                      aria-label="Link hinzufuegen"
                      value={linksInputDraft}
                      disabled={controlsDisabled}
                      onChange={(event) => {
                        setLinksInputDraft(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleAddLink(event.currentTarget.value);
                        }
                      }}
                    />
                    <ul className="frontmatter-links-list">
                      {linksDocument.links.map((link) => (
                        <li key={link} className="frontmatter-links-item">
                          <button
                            type="button"
                            className="frontmatter-inline-link"
                            onClick={() => {
                              onNavigateWikilink?.(link);
                            }}
                            title={extractWikilinkTarget(link) ?? link}
                          >
                            {resolveWikilinkLabel(link)}
                          </button>
                          <button
                            type="button"
                            className="frontmatter-link-remove"
                            disabled={controlsDisabled}
                            onClick={() => {
                              handleRemoveLink(link);
                            }}
                            aria-label={`${link} entfernen`}
                          >
                            x
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="frontmatter-add-row">
            <div className="frontmatter-add-input-wrap frontmatter-add-type-wrap">
              <button
                ref={addTypeButtonRef}
                type="button"
                className="frontmatter-type-select"
                aria-label="Attribut-Typ"
                aria-haspopup="listbox"
                aria-expanded={isAddTypeDropdownOpen}
                aria-controls={isAddTypeDropdownOpen ? addTypeSuggestionListId : undefined}
                disabled={controlsDisabled}
                onFocus={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  activateAddInput("type");
                  setOpenSuggestionsKey(addTypeSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addTypeSuggestionScope]: Math.max(
                      0,
                      addTypeOptions.findIndex((option) => option.kind === addTypeDraft),
                    ),
                  }));
                }}
                onClick={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  activateAddInput("type");
                  setOpenSuggestionsKey(addTypeSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addTypeSuggestionScope]: Math.max(
                      0,
                      addTypeOptions.findIndex((option) => option.kind === addTypeDraft),
                    ),
                  }));
                }}
                onDoubleClick={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  beginAddEditing("type");
                  setOpenSuggestionsKey(addTypeSuggestionScope);
                }}
                onBlur={() => {
                  setOpenSuggestionsKey((current) =>
                    current === addTypeSuggestionScope ? null : current
                  );
                  setAddEditorModes((current) => ({
                    ...current,
                    type: "idle",
                  }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "F2") {
                    event.preventDefault();
                    beginAddEditing("type");
                    setOpenSuggestionsKey(addTypeSuggestionScope);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpenSuggestionsKey((current) =>
                      current === addTypeSuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      type: "idle",
                    }));
                    return;
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    if (!isAddTypeDropdownOpen) {
                      setOpenSuggestionsKey(addTypeSuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addTypeSuggestionScope]: Math.max(
                          0,
                          addTypeOptions.findIndex((option) => option.kind === addTypeDraft),
                        ),
                      }));
                      return;
                    }
                    const offset = event.key === "ArrowDown" ? 1 : -1;
                    setSuggestionCursor((current) => {
                      const existing = current[addTypeSuggestionScope] ?? 0;
                      const next =
                        (existing + offset + addTypeOptions.length) %
                        addTypeOptions.length;
                      return { ...current, [addTypeSuggestionScope]: next };
                    });
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (isAddTypeDropdownOpen && activeAddTypeSuggestion) {
                      setAddTypeSelection(activeAddTypeSuggestion.kind);
                      return;
                    }
                    setOpenSuggestionsKey(addTypeSuggestionScope);
                    return;
                  }
                  if (event.key === "Tab") {
                    setOpenSuggestionsKey((current) =>
                      current === addTypeSuggestionScope ? null : current
                    );
                  }
                }}
              >
                <span className="frontmatter-type-select-icon" aria-hidden="true">
                  <FrontmatterPropertyIconView icon={addTypeOption.icon} />
                </span>
                <span className="frontmatter-type-select-label">{addTypeOption.label}</span>
                <span className="frontmatter-type-select-chevron" aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </button>
              {isAddTypeDropdownOpen ? (
                <ul
                  id={addTypeSuggestionListId}
                  className="frontmatter-suggestions frontmatter-type-suggestions"
                  role="listbox"
                  aria-label="Attribut-Typ Vorschlaege"
                >
                  {addTypeOptions.map((option, optionIndex) => (
                    <li key={`add-type-${option.kind}`}>
                      <button
                        type="button"
                        className={`frontmatter-suggestion-option frontmatter-type-option ${
                          optionIndex === safeAddTypeSuggestionIndex ? "active" : ""
                        }`}
                        role="option"
                        aria-selected={optionIndex === safeAddTypeSuggestionIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          setAddTypeSelection(option.kind);
                        }}
                      >
                        <span className="frontmatter-type-option-icon" aria-hidden="true">
                          <FrontmatterPropertyIconView icon={option.icon} />
                        </span>
                        <span className="frontmatter-type-option-copy">
                          <span className="frontmatter-type-option-label">{option.label}</span>
                          <span className="frontmatter-type-option-description">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="frontmatter-add-input-wrap">
              <input
                ref={addKeyInputRef}
                type="text"
                className="text-input frontmatter-add-key"
                placeholder={isAddKeyAutoManaged ? "Automatischer Name" : "Neues Attribut"}
                aria-label="Neues Attribut"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isAddKeyDropdownOpen}
                aria-controls={isAddKeyDropdownOpen ? addKeySuggestionListId : undefined}
                value={autoManagedAddKey ?? addKeyDraft}
                readOnly={isAddKeyAutoManaged || !isAddKeyEditing}
                disabled={controlsDisabled}
                onInput={(event) => {
                  if (isAddKeyAutoManaged) {
                    return;
                  }
                  setAddKeyDraft(event.currentTarget.value);
                  if (addError) {
                    setAddError("");
                  }
                  setOpenSuggestionsKey(addKeySuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addKeySuggestionScope]: 0,
                  }));
                }}
                onFocus={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  if (isAddKeyAutoManaged) {
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      key: "idle",
                    }));
                    return;
                  }
                  activateAddInput("key");
                  setOpenSuggestionsKey(addKeySuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addKeySuggestionScope]: 0,
                  }));
                }}
                onClick={() => {
                  if (controlsDisabled) {
                    return;
                  }
                  if (isAddKeyAutoManaged) {
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    scheduleAnimationFrame(() => {
                      addValueInputRef.current?.focus();
                    });
                    return;
                  }
                  activateAddInput("key");
                  setOpenSuggestionsKey(addKeySuggestionScope);
                }}
                onDoubleClick={() => {
                  if (controlsDisabled || isAddKeyAutoManaged) {
                    return;
                  }
                  beginAddEditing("key");
                  setOpenSuggestionsKey(addKeySuggestionScope);
                }}
                onBlur={(event) => {
                  if (!isAddKeyAutoManaged) {
                    setAddKeyDraft(event.currentTarget.value);
                  }
                  setOpenSuggestionsKey((current) =>
                    current === addKeySuggestionScope ? null : current
                  );
                  setAddEditorModes((current) => ({
                    ...current,
                    key: "idle",
                  }));
                }}
                onKeyDown={(event) => {
                  if (isAddKeyAutoManaged) {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      scheduleAnimationFrame(() => {
                        addValueInputRef.current?.focus();
                      });
                      return;
                    }
                    if (event.key === "Tab") {
                      setOpenSuggestionsKey((current) =>
                        current === addKeySuggestionScope ? null : current
                      );
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpenSuggestionsKey((current) =>
                        current === addKeySuggestionScope ? null : current
                      );
                      event.currentTarget.blur();
                      return;
                    }
                    if (isPrintableCharacterKey(event) || event.key === "Backspace" || event.key === "Delete") {
                      event.preventDefault();
                    }
                    return;
                  }
                  if (event.key === "F2") {
                    event.preventDefault();
                    beginAddEditing("key");
                    setOpenSuggestionsKey(addKeySuggestionScope);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      key: "idle",
                    }));
                    event.currentTarget.blur();
                    return;
                  }
                  if (
                    isAddKeyDropdownOpen &&
                    (event.key === "ArrowDown" || event.key === "ArrowUp")
                  ) {
                    event.preventDefault();
                    const offset = event.key === "ArrowDown" ? 1 : -1;
                    setSuggestionCursor((current) => {
                      const existing = current[addKeySuggestionScope] ?? 0;
                      const next =
                        (existing + offset + addKeySuggestions.length) %
                        addKeySuggestions.length;
                      return { ...current, [addKeySuggestionScope]: next };
                    });
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (isAddKeyDropdownOpen && activeAddKeySuggestion) {
                      setAddKeyDraft(activeAddKeySuggestion);
                      setOpenSuggestionsKey(null);
                      setAddEditorModes((current) => ({
                        ...current,
                        key: "active",
                      }));
                      if (addError) {
                        setAddError("");
                      }
                      scheduleAnimationFrame(() => {
                        addValueInputRef.current?.focus();
                      });
                      return;
                    }
                    scheduleAnimationFrame(() => {
                      addValueInputRef.current?.focus();
                    });
                    return;
                  }
                  if (event.key === "Tab") {
                    setOpenSuggestionsKey((current) =>
                      current === addKeySuggestionScope ? null : current
                    );
                    return;
                  }
                  if (!isAddKeyEditing) {
                    if (isPrintableCharacterKey(event)) {
                      event.preventDefault();
                      const nextValue = `${addKeyDraft}${event.key}`;
                      setAddKeyDraft(nextValue);
                      beginAddEditing("key");
                      setOpenSuggestionsKey(addKeySuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addKeySuggestionScope]: 0,
                      }));
                      if (addError) {
                        setAddError("");
                      }
                      scheduleAnimationFrame(() => {
                        const input = addKeyInputRef.current;
                        if (!input) {
                          return;
                        }
                        input.focus();
                        input.setSelectionRange(nextValue.length, nextValue.length);
                      });
                      return;
                    }
                    if (event.key === "Backspace" || event.key === "Delete") {
                      event.preventDefault();
                      const nextValue =
                        event.key === "Backspace" ? addKeyDraft.slice(0, -1) : "";
                      setAddKeyDraft(nextValue);
                      beginAddEditing("key");
                      setOpenSuggestionsKey(addKeySuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addKeySuggestionScope]: 0,
                      }));
                      if (addError) {
                        setAddError("");
                      }
                    }
                  }
                }}
              />
              {isAddKeyDropdownOpen ? (
                <ul
                  id={addKeySuggestionListId}
                  className="frontmatter-suggestions"
                  role="listbox"
                  aria-label="Attribut Vorschlaege"
                >
                  {addKeySuggestions.map((suggestion, suggestionIndex) => (
                    <li key={`add-key-${suggestion}`}>
                      <button
                        type="button"
                        className={`frontmatter-suggestion-option ${
                          suggestionIndex === safeAddKeySuggestionIndex ? "active" : ""
                        }`}
                        role="option"
                        aria-selected={suggestionIndex === safeAddKeySuggestionIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          setAddKeyDraft(suggestion);
                          setOpenSuggestionsKey(null);
                          setAddEditorModes((current) => ({
                            ...current,
                            key: "active",
                          }));
                          if (addError) {
                            setAddError("");
                          }
                          scheduleAnimationFrame(() => {
                            addValueInputRef.current?.focus();
                          });
                        }}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="frontmatter-add-input-wrap">
              <input
                ref={addValueInputRef}
                type="text"
                className="text-input frontmatter-add-value"
                placeholder="Wert (optional)"
                aria-label="Neuer Wert"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isAddValueDropdownOpen}
                aria-controls={isAddValueDropdownOpen ? addValueSuggestionListId : undefined}
                value={addValueDraft}
                readOnly={!isAddValueEditing}
                disabled={controlsDisabled}
                onInput={(event) => {
                  setAddValueDraft(event.currentTarget.value);
                  setOpenSuggestionsKey(addValueSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addValueSuggestionScope]: 0,
                  }));
                }}
                onFocus={() => {
                  if (controlsDisabled || !isAddValueEnabled) {
                    return;
                  }
                  activateAddInput("value");
                  setOpenSuggestionsKey(addValueSuggestionScope);
                  setSuggestionCursor((current) => ({
                    ...current,
                    [addValueSuggestionScope]: 0,
                  }));
                }}
                onClick={() => {
                  if (controlsDisabled || !isAddValueEnabled) {
                    return;
                  }
                  activateAddInput("value");
                  setOpenSuggestionsKey(addValueSuggestionScope);
                }}
                onDoubleClick={() => {
                  if (controlsDisabled || !isAddValueEnabled) {
                    return;
                  }
                  beginAddEditing("value");
                  setOpenSuggestionsKey(addValueSuggestionScope);
                }}
                onBlur={(event) => {
                  setAddValueDraft(event.currentTarget.value);
                  setOpenSuggestionsKey((current) =>
                    current === addValueSuggestionScope ? null : current
                  );
                  setAddEditorModes((current) => ({
                    ...current,
                    value: "idle",
                  }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "F2" && isAddValueEnabled) {
                    event.preventDefault();
                    beginAddEditing("value");
                    setOpenSuggestionsKey(addValueSuggestionScope);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpenSuggestionsKey((current) =>
                      current === addValueSuggestionScope ? null : current
                    );
                    setAddEditorModes((current) => ({
                      ...current,
                      value: "idle",
                    }));
                    event.currentTarget.blur();
                    return;
                  }
                  if (
                    isAddValueDropdownOpen &&
                    (event.key === "ArrowDown" || event.key === "ArrowUp")
                  ) {
                    event.preventDefault();
                    const offset = event.key === "ArrowDown" ? 1 : -1;
                    setSuggestionCursor((current) => {
                      const existing = current[addValueSuggestionScope] ?? 0;
                      const next =
                        (existing + offset + addValueSuggestions.length) %
                        addValueSuggestions.length;
                      return { ...current, [addValueSuggestionScope]: next };
                    });
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (isAddValueDropdownOpen && activeAddValueSuggestion) {
                      setAddValueDraft(activeAddValueSuggestion);
                      setOpenSuggestionsKey(null);
                      setAddEditorModes((current) => ({
                        ...current,
                        value: "active",
                      }));
                      return;
                    }
                    void handleAddProperty();
                    return;
                  }
                  if (event.key === "Tab") {
                    setOpenSuggestionsKey((current) =>
                      current === addValueSuggestionScope ? null : current
                    );
                    return;
                  }
                  if (!isAddValueEnabled) {
                    return;
                  }
                  if (!isAddValueEditing) {
                    if (isPrintableCharacterKey(event)) {
                      event.preventDefault();
                      const nextValue = `${addValueDraft}${event.key}`;
                      setAddValueDraft(nextValue);
                      beginAddEditing("value");
                      setOpenSuggestionsKey(addValueSuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addValueSuggestionScope]: 0,
                      }));
                      scheduleAnimationFrame(() => {
                        const input = addValueInputRef.current;
                        if (!input) {
                          return;
                        }
                        input.focus();
                        input.setSelectionRange(nextValue.length, nextValue.length);
                      });
                      return;
                    }
                    if (event.key === "Backspace" || event.key === "Delete") {
                      event.preventDefault();
                      const nextValue =
                        event.key === "Backspace" ? addValueDraft.slice(0, -1) : "";
                      setAddValueDraft(nextValue);
                      beginAddEditing("value");
                      setOpenSuggestionsKey(addValueSuggestionScope);
                      setSuggestionCursor((current) => ({
                        ...current,
                        [addValueSuggestionScope]: 0,
                      }));
                    }
                  }
                }}
              />
              {isAddValueDropdownOpen ? (
                <ul
                  id={addValueSuggestionListId}
                  className="frontmatter-suggestions"
                  role="listbox"
                  aria-label="Wert Vorschlaege"
                >
                  {addValueSuggestions.map((suggestion, suggestionIndex) => (
                    <li key={`add-value-${selectedAddKey}-${suggestion}`}>
                      <button
                        type="button"
                        className={`frontmatter-suggestion-option ${
                          suggestionIndex === safeAddValueSuggestionIndex ? "active" : ""
                        }`}
                        role="option"
                        aria-selected={suggestionIndex === safeAddValueSuggestionIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          setAddValueDraft(suggestion);
                          setOpenSuggestionsKey(null);
                          setAddEditorModes((current) => ({
                            ...current,
                            value: "active",
                          }));
                        }}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              className="ghost small frontmatter-add-button"
              onClick={() => {
                void handleAddProperty();
              }}
              disabled={controlsDisabled}
            >
              Attribut +
            </button>
          </div>
          {addError ? <div className="frontmatter-row-error">{addError}</div> : null}
        </>
      ) : (
        <p className="frontmatter-collapsed-hint">
          {collapsedAttributeCount} Attribute
        </p>
      )}
      {panelError ? <div className="error frontmatter-error">{panelError}</div> : null}
    </section>
  );
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
  markdownViewEditEnabled,
  selectedFile,
  canEdit,
  markdownEditorStyle,
  onEditChange,
  onEditCaretApplied,
  onEditExit,
  onEditStart,
  onToggleRawPreview,
  onFrontmatterSave,
  onNavigateWikilink,
  valueSuggestionsByKey,
  keySuggestions,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const markdownViewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownEditorScrollRef = useRef<HTMLDivElement | null>(null);
  const markdownEditorRef = useRef<HTMLDivElement | null>(null);
  const markdownEditorHtmlRef = useRef<string | null>(null);
  const markdownEditorReadyRef = useRef(false);
  const applyingMarkdownCaretRef = useRef(false);
  const scrollStateRef = useRef({ top: 0, left: 0 });
  const lastCaretIndexRef = useRef<number | null>(null);
  const [showFrontmatterTextFallback, setShowFrontmatterTextFallback] = useState(false);
  const [isFrontmatterPanelCollapsed, setIsFrontmatterPanelCollapsed] = useState(false);

  const previewFrontmatter = useMemo(
    () => parseFrontmatterDocument(preview),
    [preview],
  );
  const editFrontmatter = useMemo(() => parseFrontmatterDocument(editDraft), [editDraft]);
  const markdownPreviewBody = previewFrontmatter.hasFrontmatter
    ? previewFrontmatter.body
    : preview;
  const markdownEditBody = editFrontmatter.hasFrontmatter
    ? editFrontmatter.body
    : editDraft;
  const markdownEditBodyStartOffset = editFrontmatter.hasFrontmatter
    ? editFrontmatter.bodyStartOffset
    : 0;
  const hasFrontmatterError = previewFrontmatter.hasFrontmatter &&
    Boolean(previewFrontmatter.error);

  useEffect(() => {
    setShowFrontmatterTextFallback(false);
  }, [preview]);

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

  const syncMarkdownDraftFromEditor = useCallback(() => {
    if (!markdownEditorRef.current) {
      return;
    }
    if (applyingMarkdownCaretRef.current) {
      return;
    }
    const nextBody = serializeMarkdownFromHtml(markdownEditorRef.current);
    const nextValue = composeMarkdownWithBody(editDraft, nextBody);
    if (nextValue !== editDraft) {
      onEditChange(nextValue);
    }
  }, [editDraft, onEditChange]);

  const syncActiveMarkdownHeading = useCallback(() => {
    const editor = markdownEditorRef.current;
    if (!editor) {
      return;
    }
    const headings = Array.from(
      editor.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"),
    );
    const hrLines = Array.from(
      editor.querySelectorAll<HTMLElement>('[data-md-hr-line="true"]'),
    );
    const listItems = Array.from(
      editor.querySelectorAll<HTMLElement>("li"),
    ).filter(
      (item) =>
        item.firstElementChild instanceof HTMLElement &&
        item.firstElementChild.classList.contains("md-list-marker"),
    );
    const codeBlocks = Array.from(
      editor.querySelectorAll<HTMLElement>('pre[data-md-code-block="true"]'),
    );
    if (
      headings.length === 0 &&
      hrLines.length === 0 &&
      listItems.length === 0 &&
      codeBlocks.length === 0
    ) {
      return;
    }

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;
    const inEditor = range ? editor.contains(range.startContainer) : false;
    const activeHeading = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest("h1,h2,h3,h4,h5,h6")
      : null;
    const activeHrLine = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest('[data-md-hr-line="true"]')
      : null;
    const activeListItem = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest("li")
      : null;
    const activeCodeBlock = inEditor
      ? (range?.startContainer instanceof Element
          ? range.startContainer
          : range?.startContainer.parentElement
        )?.closest('pre[data-md-code-block="true"]')
      : null;
    const retagQueue: Array<{
      heading: HTMLElement;
      resolvedLevel: number;
    }> = [];

    headings.forEach((heading) => {
      const levelRaw = Number.parseInt(heading.tagName.slice(1), 10);
      const fallbackLevel = Number.isNaN(levelRaw)
        ? Number.parseInt(heading.getAttribute("data-md-heading-level") ?? "1", 10)
        : levelRaw;
      const levelMatch = (heading.textContent ?? "").match(/^\s*\\?(#{1,6})(?:\s+|$)/);
      const resolvedLevel = levelMatch
        ? Math.max(1, Math.min(6, levelMatch[1].length))
        : Math.max(1, Math.min(6, Number.isFinite(fallbackLevel) ? fallbackLevel : 1));
      heading.setAttribute("data-md-heading-level", String(resolvedLevel));

      if (heading === activeHeading) {
        heading.setAttribute("data-md-heading-active", "true");
      } else {
        heading.removeAttribute("data-md-heading-active");
        if (resolvedLevel !== levelRaw) {
          retagQueue.push({ heading, resolvedLevel });
        }
      }
    });

    retagQueue.forEach(({ heading, resolvedLevel }) => {
      const retagged = replaceHeadingElementLevel(heading, resolvedLevel);
      retagged.setAttribute("data-md-heading-level", String(resolvedLevel));
      retagged.removeAttribute("data-md-heading-active");
    });

    hrLines.forEach((line) => {
      if (line === activeHrLine) {
        line.setAttribute("data-md-hr-active", "true");
      } else {
        line.removeAttribute("data-md-hr-active");
      }
    });

    listItems.forEach((item) => {
      if (item === activeListItem) {
        item.setAttribute("data-md-list-active", "true");
      } else {
        item.removeAttribute("data-md-list-active");
      }
    });

    codeBlocks.forEach((block) => {
      if (block === activeCodeBlock) {
        block.setAttribute("data-md-code-active", "true");
      } else {
        block.removeAttribute("data-md-code-active");
      }
    });
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
    syncActiveMarkdownHeading();
  }, [isEditing, rawPreview, syncActiveMarkdownHeading]);

  useEffect(() => {
    if (!isEditing || rawPreview) {
      return;
    }
    const handleSelectionChange = () => {
      const editor = markdownEditorRef.current;
      if (!editor) {
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
        return;
      }
      syncActiveMarkdownHeading();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [isEditing, rawPreview, syncActiveMarkdownHeading]);

  useLayoutEffect(() => {
    if (isEditing) {
      if (rawPreview) {
        restoreScroll(editorRef.current);
      } else {
        restoreScroll(markdownEditorScrollRef.current);
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
    applyingMarkdownCaretRef.current = true;
    const bodyCaretIndex = Math.max(
      0,
      editCaretIndex - markdownEditBodyStartOffset,
    );
    const plainOffset = mapRawIndexToPlainOffset(markdownEditBody, bodyCaretIndex, {
      skipStructuralMarkers: false,
    });
    const desiredScrollTop = scrollStateRef.current.top;
    const desiredScrollLeft = scrollStateRef.current.left;
    const enforceScroll = () => {
      editor.scrollTop = desiredScrollTop;
      editor.scrollLeft = desiredScrollLeft;
    };
    const handle = window.requestAnimationFrame(() => {
      try {
        editor.focus({ preventScroll: true });
      } catch {
        editor.focus();
      }
      try {
        setCaretAtPlainOffset(editor, plainOffset);
        enforceScroll();
        lastCaretIndexRef.current = editCaretIndex;
        scrollStateRef.current.top = editor.scrollTop;
        scrollStateRef.current.left = editor.scrollLeft;
      } finally {
        applyingMarkdownCaretRef.current = false;
        onEditCaretApplied();
      }
    });
    return () => {
      window.cancelAnimationFrame(handle);
      applyingMarkdownCaretRef.current = false;
    };
  }, [
    editCaretIndex,
    isEditing,
    markdownEditBody,
    markdownEditBodyStartOffset,
    onEditCaretApplied,
    rawPreview,
  ]);

  const handleCodeCopyClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const codeBlock = event.currentTarget.closest(".md-code-block");
      const code = codeBlock?.querySelector("pre > code")?.textContent ?? "";
      if (!code) {
        return;
      }
      void copyTextToClipboard(code);
    },
    [],
  );

  const handleMarkdownEditorMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = resolveEventElement(event.target);
      if (!target?.closest(".md-code-copy-button")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleMarkdownEditorClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = resolveEventElement(event.target);
      const copyButton = target?.closest(".md-code-copy-button");
      if (!copyButton) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const codeBlock = copyButton.closest(".md-code-block");
      const code = codeBlock?.querySelector("pre > code")?.textContent ?? "";
      if (!code) {
        return;
      }
      void copyTextToClipboard(code);
    },
    [],
  );

  const handlePreviewLinkClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const link = resolveAnchorTarget(event.target);
      if (!link) {
        return;
      }
      const href = link.getAttribute("href")?.trim() ?? "";
      if (event.button !== 0) {
        event.preventDefault();
        return;
      }
      if (isModifierClick(event)) {
        const safeHref = resolveSafeHref(href);
        if (safeHref) {
          event.preventDefault();
          event.stopPropagation();
          void openUrl(safeHref);
          return;
        }
      }
      event.preventDefault();
    },
    [],
  );

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!canEdit || isEditing) {
        return;
      }
      if (!canStartPreviewEdit({ rawPreview, markdownViewEditEnabled })) {
        return;
      }
      if (!rawPreview && hasFrontmatterError && showFrontmatterTextFallback) {
        return;
      }
      const eventElement = resolveEventElement(event.target);
      if (!rawPreview && eventElement?.closest(".frontmatter-panel")) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      if (isModifierClick(event)) {
        const link = resolveAnchorTarget(event.target);
        const safeHref = link
          ? resolveSafeHref(link.getAttribute("href")?.trim() ?? "")
          : null;
        if (safeHref) {
          return;
        }
      }
      const origin = rawPreview ? "raw" : "markdown";
      const bodyStartOffset = previewFrontmatter.hasFrontmatter
        ? previewFrontmatter.bodyStartOffset
        : 0;
      const markdownSource = previewFrontmatter.hasFrontmatter
        ? previewFrontmatter.body
        : preview;
      let caretIndex = rawPreview
        ? preview.length === 0
          ? 0
          : null
        : markdownSource.length === 0
          ? bodyStartOffset
          : null;
      const selectionContainer = rawPreview
        ? previewRef.current
        : (markdownViewRef.current ?? previewRef.current);
      if (selectionContainer) {
        captureScroll(previewRef.current ?? selectionContainer);
        const selection = getSelectionRange(selectionContainer);
        if (selection && !selection.collapsed) {
          return;
        }
        const range = getRangeFromEvent(event, selectionContainer);
        const resolvedIndex = rawPreview
          ? resolveRawCaretIndex(selectionContainer, range)
          : resolveMarkdownCaretIndex(selectionContainer, markdownSource, range);
        if (typeof resolvedIndex === "number") {
          caretIndex = rawPreview ? resolvedIndex : bodyStartOffset + resolvedIndex;
        }
        if (!rawPreview) {
          markdownEditorHtmlRef.current = buildEditableMarkdownHtml(
            selectionContainer,
            markdownSource,
          );
        }
      } else if (!rawPreview) {
        markdownEditorHtmlRef.current = "";
      }
      if (caretIndex === null) {
        if (typeof lastCaretIndexRef.current === "number") {
          caretIndex = lastCaretIndexRef.current;
        } else if (rawPreview && preview.length > 0) {
          caretIndex = preview.length;
        } else if (!rawPreview && markdownSource.length > 0) {
          caretIndex = bodyStartOffset + markdownSource.length;
        }
      }
      if (typeof caretIndex === "number") {
        lastCaretIndexRef.current = caretIndex;
      }
      onEditStart({ caretIndex, origin });
    },
    [
      canEdit,
      captureScroll,
      isEditing,
      markdownViewEditEnabled,
      onEditStart,
      preview,
      hasFrontmatterError,
      previewFrontmatter.body,
      previewFrontmatter.bodyStartOffset,
      previewFrontmatter.hasFrontmatter,
      rawPreview,
      showFrontmatterTextFallback,
    ],
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
      captureScroll(markdownEditorScrollRef.current);
      const bodyCaretIndex = resolveMarkdownCaretIndex(
        event.currentTarget,
        markdownEditBody,
        null,
        { skipStructuralMarkers: false },
      );
      if (typeof bodyCaretIndex === "number") {
        lastCaretIndexRef.current = markdownEditBodyStartOffset + bodyCaretIndex;
      }
      onEditExit();
    },
    [
      captureScroll,
      markdownEditBody,
      markdownEditBodyStartOffset,
      markdownEditorScrollRef,
      onEditExit,
    ],
  );

  const handleMarkdownInput = useCallback(() => {
    syncMarkdownDraftFromEditor();
    syncActiveMarkdownHeading();
  }, [syncActiveMarkdownHeading, syncMarkdownDraftFromEditor]);

  const markdownSource = rawPreview
    ? preview
    : hasFrontmatterError && showFrontmatterTextFallback
      ? preview
      : markdownPreviewBody;
  const normalizedMarkdownSource = rawPreview
    ? preview
    : normalizeTableSpacingForRender(markdownSource);
  const renderedPreview = rawPreview
    ? preview
    : markdownViewEditEnabled
      ? normalizedMarkdownSource
      : applyInteractionSpacing(normalizedMarkdownSource);
  const hasVisiblePreviewContent = rawPreview
    ? preview.length > 0
    : markdownSource.length > 0;
  const showFrontmatterPanel = !rawPreview &&
    previewState === "idle" &&
    previewFrontmatter.hasFrontmatter &&
    !previewFrontmatter.error;
  const previewToggleLabel = rawPreview
    ? "Switch to Markdown preview"
    : "Switch to Rohtext";
  const ToggleIcon = rawPreview ? MarkdownIcon : CodeIcon;
  const showMarkdownEditor = markdownViewEditEnabled && !rawPreview;
  const handleToggleFrontmatterPanelCollapsed = useCallback(() => {
    setIsFrontmatterPanelCollapsed((current) => !current);
  }, []);

  return (
    <section className="panel preview-panel" style={markdownEditorStyle}>
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
            className={`ghost small preview-toggle-button ${rawPreview ? "active" : ""}`}
            onClick={onToggleRawPreview}
            aria-pressed={rawPreview}
            aria-label={previewToggleLabel}
            title={previewToggleLabel}
            disabled={!selectedFile}
          >
            <span className="preview-toggle-icon" aria-hidden="true">
              <ToggleIcon />
            </span>
          </button>
          {previewState === "loading" ? <span className="chip">Lade...</span> : null}
        </div>
      </div>
      <div className="panel-body preview-body">
        {previewState === "error" ? (
          <div className="error">{previewError}</div>
        ) : null}
        {previewState === "idle" && !rawPreview && previewFrontmatter.hasFrontmatter &&
        previewFrontmatter.error ? (
          <section className="frontmatter-panel frontmatter-panel-error" aria-label="Eigenschaften">
            <div className="frontmatter-header">
              <h3>Eigenschaften</h3>
            </div>
            <div className="error">
              <p>YAML-Frontmatter konnte nicht gelesen werden.</p>
              <p className="frontmatter-parse-message">{previewFrontmatter.error}</p>
            </div>
            <div className="frontmatter-error-actions">
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  setShowFrontmatterTextFallback((current) => !current);
                }}
              >
                {showFrontmatterTextFallback
                  ? "Frontmatter wieder ausblenden"
                  : "Frontmatter als Text anzeigen"}
              </button>
            </div>
          </section>
        ) : null}
        <div
          className="preview-content"
          onClick={handlePreviewLinkClick}
          onAuxClick={handlePreviewLinkClick}
          onMouseUp={handlePreviewClick}
        >
          <div className="preview-surface">
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
              ) : showMarkdownEditor ? (
                <div
                  key="markdown-edit"
                  ref={markdownEditorScrollRef}
                  className="preview preview-editor markdown md-preview"
                  onScroll={(event) => captureScroll(event.currentTarget)}
                >
                  {showFrontmatterPanel ? (
                    <FrontmatterPropertiesPanel
                      sourceMarkdown={preview}
                      properties={previewFrontmatter.properties}
                      canEdit={canEdit && previewState === "idle" && !isEditing}
                      isCollapsed={isFrontmatterPanelCollapsed}
                      onToggleCollapsed={handleToggleFrontmatterPanelCollapsed}
                      onFrontmatterSave={onFrontmatterSave}
                      onNavigateWikilink={onNavigateWikilink}
                      valueSuggestionsByKey={valueSuggestionsByKey}
                      keySuggestions={keySuggestions}
                    />
                  ) : null}
                  <div
                    ref={markdownEditorRef}
                    className="preview-markdown-editable md-preview"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleMarkdownInput}
                    onBlur={handleMarkdownEditorBlur}
                    onFocus={syncActiveMarkdownHeading}
                    onKeyUp={syncActiveMarkdownHeading}
                    onMouseDown={handleMarkdownEditorMouseDown}
                    onMouseUp={syncActiveMarkdownHeading}
                    onClick={handleMarkdownEditorClick}
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Edit markdown preview"
                  />
                </div>
              ) : null
            ) : hasVisiblePreviewContent ? (
              <div
                key={rawPreview ? "raw-view" : "markdown-view"}
                ref={previewRef}
                className={`preview ${rawPreview ? "raw" : "markdown"}${
                  rawPreview ? "" : " md-preview"
                }`}
                onScroll={(event) => captureScroll(event.currentTarget)}
              >
                {rawPreview ? (
                  <pre>{preview}</pre>
                ) : (
                  <>
                    {showFrontmatterPanel ? (
                      <FrontmatterPropertiesPanel
                        sourceMarkdown={preview}
                        properties={previewFrontmatter.properties}
                        canEdit={canEdit && previewState === "idle"}
                        isCollapsed={isFrontmatterPanelCollapsed}
                        onToggleCollapsed={handleToggleFrontmatterPanelCollapsed}
                        onFrontmatterSave={onFrontmatterSave}
                        onNavigateWikilink={onNavigateWikilink}
                        valueSuggestionsByKey={valueSuggestionsByKey}
                        keySuggestions={keySuggestions}
                      />
                    ) : null}
                    <div ref={markdownViewRef}>
                      <ReactMarkdown
                        remarkPlugins={[
                          remarkGfm,
                          remarkPreserveSoftBreaks,
                          remarkPreserveOrderedListDelimiters,
                        ]}
                        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
                        components={{
                          ol: ({ node, ...props }) => {
                            const delimiterFromNode =
                              node &&
                              typeof node === "object" &&
                              "properties" in node &&
                              node.properties &&
                              typeof node.properties === "object"
                                ? (node.properties as Record<string, unknown>)[
                                    "data-md-ordered-delimiter"
                                  ]
                                : null;
                            const delimiterFromPosition = resolveOrderedListDelimiter(
                              renderedPreview,
                              node &&
                                typeof node === "object" &&
                                "position" in node &&
                                node.position &&
                                typeof node.position === "object" &&
                                "start" in node.position &&
                                node.position.start &&
                                typeof node.position.start === "object" &&
                                ("offset" in node.position.start || "line" in node.position.start)
                                ? (node.position.start as { offset?: number; line?: number })
                                : undefined,
                            );
                            if (delimiterFromNode !== ")" && delimiterFromPosition !== ")") {
                              return <ol {...props} />;
                            }
                            const startRaw = props.start;
                            const startValue = typeof startRaw === "number"
                              ? startRaw
                              : Number.parseInt(String(startRaw ?? "1"), 10);
                            const previous = Number.isNaN(startValue) ? 0 : Math.max(0, startValue - 1);
                            const style = {
                              ...(props.style ?? {}),
                              "--md-ordered-start": String(previous),
                            } as CSSProperties;
                            return <ol {...props} style={style} data-md-ordered-delimiter=")" />;
                          },
                          pre: ({ node: _node, ...props }) => (
                            <div className="md-code-block">
                              <button
                                type="button"
                                className="md-code-copy-button"
                                aria-label="Copy code block"
                                title="Copy code block"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onMouseUp={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={handleCodeCopyClick}
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                                  <rect
                                    x="9"
                                    y="9"
                                    width="10"
                                    height="10"
                                    rx="2"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                  />
                                  <path
                                    d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                              <pre {...props} />
                            </div>
                          ),
                          table: ({ node: _node, ...props }) => (
                            <div className="markdown-table">
                              <table {...props} />
                            </div>
                          ),
                          img: ({ node: _node, ...props }) => (
                            <img {...props} draggable={false} />
                          ),
                        }}
                      >
                        {renderedPreview}
                      </ReactMarkdown>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div key="preview-empty" className="preview placeholder">
                {emptyPreview}
              </div>
            )}
          </div>
        </div>
        {editError ? <div className="error">{editError}</div> : null}
      </div>
    </section>
  );
};
