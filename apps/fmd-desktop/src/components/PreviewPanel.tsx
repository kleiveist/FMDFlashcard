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
  type FrontmatterProperty,
  type FrontmatterPropertyIcon,
  type FrontmatterPropertyKind,
  composeMarkdownWithBody,
  normalizeWikilinkValue,
  parseFrontmatterDocument,
  reorderFrontmatterProperties,
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

const isModifierClick = (event: Pick<MouseEvent<HTMLElement>, "metaKey" | "ctrlKey">) =>
  event.metaKey || event.ctrlKey;

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

    if (!isEscaped && lineStart && !inFence) {
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

    if (!isEscaped && lineStart && !inFence) {
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
  return `${fence}\n${trimmed}\n${fence}\n\n`;
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
    return escapeMarkdownText(node.nodeValue ?? "", context.escapePipes);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

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
    const content = serializeMarkdownChildren(element, context).trim();
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
  const text = serializeMarkdownChildren(element, {
    ...context,
    escapePipes: false,
  })
    .replace(/\n+/g, " ")
    .trim();
  return escapeMarkdownTableCell(text);
};

export const serializeMarkdownFromHtml = (container: HTMLElement) => {
  return serializeMarkdownChildren(container, {
    listDepth: 0,
    escapePipes: true,
    inContentEditable: true,
  });
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

type FrontmatterPropertiesPanelProps = {
  sourceMarkdown: string;
  properties: FrontmatterProperty[];
  canEdit: boolean;
  onFrontmatterSave?: (nextPreview: string) => Promise<boolean>;
};

const FrontmatterPropertiesPanel = ({
  sourceMarkdown,
  properties,
  canEdit,
  onFrontmatterSave,
}: FrontmatterPropertiesPanelProps) => {
  const initialDrafts = useMemo(() => {
    const next: Record<string, string> = {};
    properties.forEach((property) => {
      next[property.key] = stringifyPropertyValue(property);
    });
    return next;
  }, [properties]);
  const [drafts, setDrafts] = useState<Record<string, string>>(initialDrafts);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [panelError, setPanelError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [addKeyDraft, setAddKeyDraft] = useState("");
  const [addValueDraft, setAddValueDraft] = useState("");
  const [addError, setAddError] = useState("");
  const [dragPropertyKey, setDragPropertyKey] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    key: string;
    position: "before" | "after";
  } | null>(null);

  useEffect(() => {
    setDrafts(initialDrafts);
    setTagInputs({});
    setRowErrors({});
    setPanelError("");
    setDragPropertyKey(null);
    setDropHint(null);
  }, [initialDrafts]);

  const resetDraftsFromProperties = useCallback(() => {
    setDrafts(initialDrafts);
    setTagInputs({});
    setRowErrors({});
  }, [initialDrafts]);

  const saveBusy = savingKey !== null;
  const controlsDisabled = !canEdit || !onFrontmatterSave || saveBusy;

  const commitPropertyChange = useCallback(
    async ({
      property,
      kind,
      value,
    }: {
      property: FrontmatterProperty;
      kind: FrontmatterPropertyKind;
      value: string | number | boolean | string[] | null;
    }) => {
      if (!onFrontmatterSave || !canEdit || saveBusy) {
        return;
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
        return;
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
      }
    },
    [canEdit, onFrontmatterSave, resetDraftsFromProperties, saveBusy, sourceMarkdown],
  );

  const handleAddProperty = useCallback(async () => {
    if (controlsDisabled || !onFrontmatterSave) {
      return;
    }
    const nextKey = addKeyDraft.trim();
    if (!nextKey) {
      setAddError("Bitte einen Attribut-Namen angeben.");
      return;
    }
    if (nextKey.includes(":")) {
      setAddError("Attribut-Name darf kein ':' enthalten.");
      return;
    }
    const duplicate = properties.some((property) => property.key === nextKey);
    if (duplicate) {
      setAddError(`Attribut "${nextKey}" existiert bereits.`);
      return;
    }
    const updated = addFrontmatterProperty({
      markdown: sourceMarkdown,
      key: nextKey,
      value: addValueDraft,
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
    setAddKeyDraft("");
    setAddValueDraft("");
  }, [
    addKeyDraft,
    addValueDraft,
    controlsDisabled,
    onFrontmatterSave,
    properties,
    sourceMarkdown,
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

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => !current);
  }, []);

  return (
    <section className="frontmatter-panel" aria-label="Eigenschaften">
      <div className="frontmatter-header">
        <button
          type="button"
          className="frontmatter-title-button"
          aria-expanded={!isCollapsed}
          onClick={toggleCollapsed}
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
            onClick={toggleCollapsed}
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
            {properties.map((property) => {
              const isRowSaving = savingKey === property.key;
              const rowDisabled = controlsDisabled || isRowSaving;
              const tags = Array.isArray(property.value) ? property.value : [];
              const rowError = rowErrors[property.key] ?? "";

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
                  case "number":
                    return (
                      <div className="frontmatter-input-wrap">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="text-input frontmatter-input"
                          placeholder="Kein Wert"
                          aria-label={`${property.key} value`}
                          value={drafts[property.key] ?? ""}
                          disabled={rowDisabled}
                          onChange={(event) => {
                            const next = event.target.value;
                            setDrafts((current) => ({ ...current, [property.key]: next }));
                            if (rowErrors[property.key]) {
                              setRowErrors((current) => ({ ...current, [property.key]: "" }));
                            }
                          }}
                          onBlur={() => {
                            const value = (drafts[property.key] ?? "").trim();
                            if (!value) {
                              setRowErrors((current) => ({ ...current, [property.key]: "" }));
                              void commitPropertyChange({
                                property,
                                kind: "number",
                                value: null,
                              });
                              return;
                            }
                            const parsed = Number(value);
                            if (!Number.isFinite(parsed)) {
                              setRowErrors((current) => ({
                                ...current,
                                [property.key]: "Bitte eine gueltige Zahl eingeben.",
                              }));
                              return;
                            }
                            setRowErrors((current) => ({ ...current, [property.key]: "" }));
                            void commitPropertyChange({
                              property,
                              kind: "number",
                              value: parsed,
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                        />
                        {rowError ? <span className="frontmatter-row-error">{rowError}</span> : null}
                      </div>
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
                  case "link":
                  case "cover":
                  case "unknown":
                  case "text":
                  default:
                    return (
                      <input
                        type="text"
                        className="text-input frontmatter-input"
                        placeholder="Kein Wert"
                        aria-label={`${property.key} value`}
                        value={drafts[property.key] ?? ""}
                        disabled={rowDisabled}
                        onChange={(event) => {
                          const next = event.target.value;
                          setDrafts((current) => ({ ...current, [property.key]: next }));
                        }}
                        onBlur={() => {
                          const raw = drafts[property.key] ?? "";
                          const nextValue = property.kind === "link" ||
                              property.kind === "cover"
                            ? normalizeWikilinkValue(raw)
                            : raw;
                          setDrafts((current) => ({
                            ...current,
                            [property.key]: nextValue,
                          }));
                          void commitPropertyChange({
                            property,
                            kind: property.kind,
                            value: nextValue.trim() === "" ? null : nextValue,
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                      />
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
                  </div>
                  <div className="frontmatter-value" role="cell">
                    {renderValueEditor()}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="frontmatter-add-row">
            <input
              type="text"
              className="text-input frontmatter-add-key"
              placeholder="Neues Attribut"
              aria-label="Neues Attribut"
              value={addKeyDraft}
              disabled={controlsDisabled}
              onChange={(event) => {
                setAddKeyDraft(event.target.value);
                if (addError) {
                  setAddError("");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddProperty();
                }
              }}
            />
            <input
              type="text"
              className="text-input frontmatter-add-value"
              placeholder="Wert (optional)"
              aria-label="Neuer Wert"
              value={addValueDraft}
              disabled={controlsDisabled}
              onChange={(event) => {
                setAddValueDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddProperty();
                }
              }}
            />
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
          {properties.length} Attribute
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
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownEditorRef = useRef<HTMLDivElement | null>(null);
  const markdownEditorHtmlRef = useRef<string | null>(null);
  const markdownEditorReadyRef = useRef(false);
  const scrollStateRef = useRef({ top: 0, left: 0 });
  const lastCaretIndexRef = useRef<number | null>(null);
  const [showFrontmatterTextFallback, setShowFrontmatterTextFallback] = useState(false);

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
    const bodyCaretIndex = Math.max(
      0,
      editCaretIndex - markdownEditBodyStartOffset,
    );
    const plainOffset = mapRawIndexToPlainOffset(markdownEditBody, bodyCaretIndex);
    const handle = window.requestAnimationFrame(() => {
      editor.focus();
      setCaretAtPlainOffset(editor, plainOffset);
      lastCaretIndexRef.current = editCaretIndex;
      scrollStateRef.current.top = editor.scrollTop;
      scrollStateRef.current.left = editor.scrollLeft;
      onEditCaretApplied();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [
    editCaretIndex,
    isEditing,
    markdownEditBody,
    markdownEditBodyStartOffset,
    onEditCaretApplied,
    rawPreview,
  ]);

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
          : resolveMarkdownCaretIndex(container, markdownSource, range);
        if (typeof resolvedIndex === "number") {
          caretIndex = rawPreview ? resolvedIndex : bodyStartOffset + resolvedIndex;
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
      captureScroll(event.currentTarget);
      const bodyCaretIndex = resolveMarkdownCaretIndex(
        event.currentTarget,
        markdownEditBody,
        null,
      );
      if (typeof bodyCaretIndex === "number") {
        lastCaretIndexRef.current = markdownEditBodyStartOffset + bodyCaretIndex;
      }
      onEditExit();
    },
    [captureScroll, markdownEditBody, markdownEditBodyStartOffset, onEditExit],
  );

  const handleMarkdownInput = useCallback(() => {
    if (!markdownEditorRef.current) {
      return;
    }
    const nextBody = serializeMarkdownFromHtml(markdownEditorRef.current);
    const nextValue = composeMarkdownWithBody(editDraft, nextBody);
    onEditChange(nextValue);
  }, [editDraft, onEditChange]);

  const markdownSource = rawPreview
    ? preview
    : hasFrontmatterError && showFrontmatterTextFallback
      ? preview
      : markdownPreviewBody;
  const renderedPreview = rawPreview
    ? preview
    : applyInteractionSpacing(markdownSource);
  const hasVisiblePreviewContent = rawPreview
    ? preview.length > 0
    : markdownSource.length > 0;
  const showFrontmatterPanel = !rawPreview &&
    !isEditing &&
    previewState === "idle" &&
    previewFrontmatter.hasFrontmatter &&
    !previewFrontmatter.error;
  const previewToggleLabel = rawPreview
    ? "Switch to Markdown preview"
    : "Switch to Rohtext";
  const ToggleIcon = rawPreview ? MarkdownIcon : CodeIcon;
  const showMarkdownEditor = markdownViewEditEnabled && !rawPreview;

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
                  ref={markdownEditorRef}
                  className="preview preview-editor markdown md-preview"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleMarkdownInput}
                  onBlur={handleMarkdownEditorBlur}
                  onScroll={(event) => captureScroll(event.currentTarget)}
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Edit markdown preview"
                />
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
                        onFrontmatterSave={onFrontmatterSave}
                      />
                    ) : null}
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
                      components={{
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
