/**
 * @file apps/fmd-desktop/src/components/HelpButton.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Help Button samt Panel.
 *
 * Verantwortlichkeiten:
 * - Zeigt einen Hilfe-Button an, wenn Inhalt vorhanden ist.
 * - Rendert Hilfe-Text als Markdown in einem Modal.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { buildMarkdownMediaPreviewSource } from "../lib/cardMedia";
import {
  resolveMarkdownTableCellSegments,
  SHARED_TABLE_CELL_IMAGE_CLASS,
  SHARED_TABLE_CELL_MEDIA_CLASS,
  SHARED_TABLE_WRAP_CLASS,
} from "../lib/markdownTableCellMedia";
import type { VaultPngAsset } from "../lib/tree";
import { HelpIcon } from "./icons";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import { FlashcardMediaGroup } from "./flashcards/FlashcardMediaGroup";
import { SvgPreviewBlock } from "./flashcards/SvgPreviewBlock";
import { extractSvgCodeBlockSource } from "./markdownSvg";
import { MarkdownHighlightedPre } from "./MarkdownHighlightedPre";

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
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "data-fmd-media-block",
      "data-media-index",
    ],
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

const normalizeHelpBlocks = (
  helpText?: string[] | string | null,
  helpMarkdown?: string | null,
) => {
  const blocks = Array.isArray(helpText)
    ? helpText
    : typeof helpText === "string" && helpText.trim()
      ? [helpText]
      : typeof helpMarkdown === "string" && helpMarkdown.trim()
        ? [helpMarkdown]
        : [];
  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
};

export const hasHelpContent = (
  helpText?: string[] | string | null,
  helpMarkdown?: string | null,
) => normalizeHelpBlocks(helpText, helpMarkdown).length > 0;

const helpInlineMaskTokenPattern = /\[([^\]\n]+?)\]/g;

type HelpInlineMaskRenderState = {
  activeMaskId: string | null;
  onActiveMaskIdChange?: (nextMaskId: string | null) => void;
};

const resolveMarkdownNodePositionKey = (node: unknown, fallback: string) => {
  if (
    !node ||
    typeof node !== "object" ||
    !("position" in node) ||
    !node.position ||
    typeof node.position !== "object"
  ) {
    return fallback;
  }
  const position = node.position as {
    start?: {
      offset?: number;
      line?: number;
      column?: number;
    };
  };
  if (typeof position.start?.offset === "number") {
    return `offset-${position.start.offset}`;
  }
  if (typeof position.start?.line === "number" && typeof position.start?.column === "number") {
    return `line-${position.start.line}-col-${position.start.column}`;
  }
  return fallback;
};

const shouldSkipHelpInlineMaskInTag = (tagName: string | null) =>
  tagName === "code" || tagName === "pre";

const renderHelpInlineMaskedText = (
  text: string,
  keyPrefix: string,
  state: HelpInlineMaskRenderState,
): ReactNode => {
  if (!text || !helpInlineMaskTokenPattern.test(text)) {
    helpInlineMaskTokenPattern.lastIndex = 0;
    return text;
  }
  helpInlineMaskTokenPattern.lastIndex = 0;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match = helpInlineMaskTokenPattern.exec(text);
  while (match) {
    const tokenRaw = match[0] ?? "";
    const tokenInnerRaw = match[1] ?? "";
    const tokenInner = tokenInnerRaw.trim();
    const startIndex = match.index;
    const endIndex = startIndex + tokenRaw.length;

    if (startIndex > lastIndex) {
      parts.push(text.slice(lastIndex, startIndex));
    }

    if (!tokenInner) {
      parts.push(tokenRaw);
    } else {
      const maskId = `${keyPrefix}-mask-${tokenIndex}`;
      const isActive = state.activeMaskId === maskId;
      parts.push(
        <button
          type="button"
          key={maskId}
          className={`help-inline-mask${isActive ? " is-active" : ""}`}
          data-help-inline-mask="true"
          data-help-inline-mask-id={maskId}
          aria-pressed={isActive}
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            state.onActiveMaskIdChange?.(isActive ? null : maskId);
          }}
        >
          <span className="help-inline-mask-text">{tokenInner}</span>
        </button>,
      );
    }

    lastIndex = endIndex;
    tokenIndex += 1;
    match = helpInlineMaskTokenPattern.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

const renderHelpInlineMaskedNode = (
  node: ReactNode,
  keyPrefix: string,
  state: HelpInlineMaskRenderState,
): ReactNode => {
  if (typeof node === "string") {
    return renderHelpInlineMaskedText(node, keyPrefix, state);
  }
  if (typeof node === "number" || typeof node === "boolean" || node == null) {
    return node;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }
  const tagName = typeof node.type === "string" ? node.type.toLowerCase() : null;
  if (shouldSkipHelpInlineMaskInTag(tagName)) {
    return node;
  }
  const children = node.props.children;
  if (children == null) {
    return node;
  }
  const nextChildren = Children.map(children, (child, childIndex) =>
    renderHelpInlineMaskedNode(child, `${keyPrefix}-child-${childIndex}`, state)
  );
  return cloneElement(node, undefined, nextChildren);
};

const renderHelpInlineMaskedChildren = (
  children: ReactNode,
  keyPrefix: string,
  state: HelpInlineMaskRenderState,
) =>
  Children.map(children, (child, childIndex) =>
    renderHelpInlineMaskedNode(child, `${keyPrefix}-${childIndex}`, state)
  );

const readMarkdownElementProperty = (node: unknown, key: string) => {
  if (
    !node ||
    typeof node !== "object" ||
    !("properties" in node) ||
    !node.properties ||
    typeof node.properties !== "object"
  ) {
    return undefined;
  }
  const properties = node.properties as Record<string, unknown>;
  if (key in properties) {
    return properties[key];
  }
  const camelKey = key.replace(/-([a-z])/g, (_match, character: string) =>
    character.toUpperCase()
  );
  return properties[camelKey];
};

const mediaPlaceholderTextPattern = /__FMD_MEDIA_(\d+)__/;

const readMarkdownNodeText = (node: unknown): string => {
  if (!node || typeof node !== "object") {
    return "";
  }
  if ("type" in node && (node as { type?: unknown }).type === "text") {
    const value = (node as { value?: unknown }).value;
    return typeof value === "string" ? value : "";
  }
  if (!("children" in node)) {
    return "";
  }
  const children = (node as { children?: unknown }).children;
  if (!Array.isArray(children)) {
    return "";
  }
  return children.map((child) => readMarkdownNodeText(child)).join("");
};

const readMarkdownNodeSource = (node: unknown, source: string): string => {
  const resolveOffsetFromLineColumn = (line?: number, column?: number) => {
    if (typeof line !== "number" || typeof column !== "number" || line < 1 || column < 1) {
      return null;
    }
    let offset = 0;
    let currentLine = 1;
    while (currentLine < line && offset <= source.length) {
      const nextNewline = source.indexOf("\n", offset);
      if (nextNewline < 0) {
        return null;
      }
      offset = nextNewline + 1;
      currentLine += 1;
    }
    return Math.min(source.length, offset + column - 1);
  };

  if (
    node &&
    typeof node === "object" &&
    "position" in node &&
    node.position &&
    typeof node.position === "object"
  ) {
    const position = node.position as {
      start?: { offset?: number; line?: number; column?: number };
      end?: { offset?: number; line?: number; column?: number };
    };
    const startOffset = typeof position.start?.offset === "number"
      ? position.start.offset
      : resolveOffsetFromLineColumn(position.start?.line, position.start?.column);
    const endOffset = typeof position.end?.offset === "number"
      ? position.end.offset
      : resolveOffsetFromLineColumn(position.end?.line, position.end?.column);
    if (
      typeof startOffset === "number" &&
      typeof endOffset === "number" &&
      startOffset >= 0 &&
      endOffset >= startOffset &&
      endOffset <= source.length
    ) {
      const sliced = source.slice(startOffset, endOffset);
      if (sliced.length > 0) {
        return sliced;
      }
    }
  }
  return readMarkdownNodeText(node);
};

const renderTextWithLineBreaks = (text: string, keyPrefix: string): ReactNode[] => {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  lines.forEach((line, lineIndex) => {
    nodes.push(
      <Fragment key={`${keyPrefix}-line-${lineIndex}`}>
        {line}
      </Fragment>,
    );
    if (lineIndex < lines.length - 1) {
      nodes.push(<br key={`${keyPrefix}-br-${lineIndex}`} />);
    }
  });
  return nodes;
};

const renderHelpTableCellContent = ({
  node,
  children,
  keyPrefix,
  markdownSource,
  inlineMaskState,
  vaultPngAssets,
  vaultPath,
}: {
  node: unknown;
  children: ReactNode;
  keyPrefix: string;
  markdownSource: string;
  inlineMaskState: HelpInlineMaskRenderState;
  vaultPngAssets?: VaultPngAsset[] | null;
  vaultPath?: string | null;
}) => {
  const cellSource = readMarkdownNodeSource(node, markdownSource);
  const cellText = readMarkdownNodeText(node);
  const segments = resolveMarkdownTableCellSegments({
    cellSource,
    cellText,
    scope: `help-table-cell-${keyPrefix}`,
  });
  const hasMediaSegments = segments.some((segment) => segment.kind !== "text");
  if (!hasMediaSegments) {
    return renderHelpInlineMaskedChildren(
      children,
      `${keyPrefix}-plain`,
      inlineMaskState,
    );
  }

  return segments.map((segment, index) => {
    const segmentKey = `${keyPrefix}-segment-${index}`;
    if (segment.kind === "text") {
      return (
        <Fragment key={segmentKey}>
          {renderHelpInlineMaskedChildren(
            renderTextWithLineBreaks(segment.text, `${segmentKey}-text`),
            `${segmentKey}-text`,
            inlineMaskState,
          )}
        </Fragment>
      );
    }
    if (segment.kind === "media") {
      return (
        <div
          className={`help-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
          key={segmentKey}
        >
          <FlashcardMediaGroup
            media={segment.items}
            vaultPngAssets={vaultPngAssets}
            vaultPath={vaultPath}
          />
        </div>
      );
    }
    return (
      <div
        className={`help-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
        key={segmentKey}
      >
        <img
          src={segment.src}
          alt={segment.alt ?? ""}
          title={segment.title}
          className={`help-table-cell-image ${SHARED_TABLE_CELL_IMAGE_CLASS}`}
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  });
};

type HelpPanelProps = {
  helpBlocks: string[];
  title?: string;
  onClose?: () => void;
  activeMaskId?: string | null;
  onActiveMaskIdChange?: (nextMaskId: string | null) => void;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
};

export const HelpPanel = ({
  helpBlocks,
  title = "Help / Hints",
  onClose,
  activeMaskId = null,
  onActiveMaskIdChange,
  vaultPath,
  vaultPngAssets,
}: HelpPanelProps) => {
  const titleId = useId();
  const inlineMaskState = useMemo<HelpInlineMaskRenderState>(
    () => ({
      activeMaskId,
      onActiveMaskIdChange,
    }),
    [activeMaskId, onActiveMaskIdChange],
  );

  const handlePanelMouseDownCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onActiveMaskIdChange || activeMaskId === null) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-help-inline-mask='true']")) {
      return;
    }
    onActiveMaskIdChange(null);
  };

  return (
    <div
      className="modal-panel help-modal-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDownCapture={handlePanelMouseDownCapture}
    >
      <h3 id={titleId}>{title}</h3>
      <div className="help-modal-body">
        {helpBlocks.map((block, index) => (
          <section
            key={`help-block-${index}`}
            className="help-modal-section"
          >
            {helpBlocks.length > 1 ? (
              <span className="label">Hint {index + 1}</span>
            ) : null}
            <div className="help-markdown exam-markdown">
              {(() => {
                const preview = buildMarkdownMediaPreviewSource(
                  block,
                  `help-panel-${index}`,
                );
                const inlinePrefix = `help-inline-${index}`;
                return (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
                components={{
                  div: ({ node, ...props }) => {
                    const mediaBlockMarker = readMarkdownElementProperty(node, "data-fmd-media-block");
                    const placeholderMatch = readMarkdownNodeText(node).match(mediaPlaceholderTextPattern);
                    const placeholderIndex = placeholderMatch
                      ? Number.parseInt(placeholderMatch[1] ?? "", 10)
                      : Number.NaN;
                    const hasPlaceholderIndex = Number.isFinite(placeholderIndex);
                    if (typeof mediaBlockMarker === "undefined" && !hasPlaceholderIndex) {
                      return <div {...props} />;
                    }
                    const mediaIndexRaw = readMarkdownElementProperty(node, "data-media-index");
                    let mediaIndex = Number.parseInt(
                      String(mediaIndexRaw ?? ""),
                      10,
                    );
                    if (!Number.isFinite(mediaIndex) && hasPlaceholderIndex) {
                      mediaIndex = placeholderIndex;
                    }
                    const mediaGroup = Number.isFinite(mediaIndex)
                      ? (preview.groups[mediaIndex] ?? null)
                      : (preview.groups.length === 1 ? preview.groups[0] ?? null : null);
                    if (!mediaGroup) {
                      return null;
                    }
                    return (
                      <FlashcardMediaGroup
                        media={mediaGroup.items}
                        vaultPngAssets={vaultPngAssets}
                        vaultPath={vaultPath}
                      />
                    );
                  },
                  pre: ({ node: _node, children, ...props }) => {
                    const svgSource = extractSvgCodeBlockSource(children);
                    if (svgSource !== null) {
                      return <SvgPreviewBlock source={svgSource} className="md-svg-preview-block" />;
                    }
                    return <MarkdownHighlightedPre {...props}>{children}</MarkdownHighlightedPre>;
                  },
                  h1: ({ node, children, ...props }) => (
                    <h1 {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-h1-${resolveMarkdownNodePositionKey(node, "h1")}`,
                        inlineMaskState,
                      )}
                    </h1>
                  ),
                  h2: ({ node, children, ...props }) => (
                    <h2 {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-h2-${resolveMarkdownNodePositionKey(node, "h2")}`,
                        inlineMaskState,
                      )}
                    </h2>
                  ),
                  h3: ({ node, children, ...props }) => (
                    <h3 {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-h3-${resolveMarkdownNodePositionKey(node, "h3")}`,
                        inlineMaskState,
                      )}
                    </h3>
                  ),
                  h4: ({ node, children, ...props }) => (
                    <h4 {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-h4-${resolveMarkdownNodePositionKey(node, "h4")}`,
                        inlineMaskState,
                      )}
                    </h4>
                  ),
                  h5: ({ node, children, ...props }) => (
                    <h5 {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-h5-${resolveMarkdownNodePositionKey(node, "h5")}`,
                        inlineMaskState,
                      )}
                    </h5>
                  ),
                  h6: ({ node, children, ...props }) => (
                    <h6 {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-h6-${resolveMarkdownNodePositionKey(node, "h6")}`,
                        inlineMaskState,
                      )}
                    </h6>
                  ),
                  p: ({ node, children, ...props }) => (
                    <p {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-p-${resolveMarkdownNodePositionKey(node, "p")}`,
                        inlineMaskState,
                      )}
                    </p>
                  ),
                  li: ({ node, children, ...props }) => (
                    <li {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-li-${resolveMarkdownNodePositionKey(node, "li")}`,
                        inlineMaskState,
                      )}
                    </li>
                  ),
                  blockquote: ({ node, children, ...props }) => (
                    <blockquote {...props}>
                      {renderHelpInlineMaskedChildren(
                        children,
                        `${inlinePrefix}-blockquote-${resolveMarkdownNodePositionKey(node, "blockquote")}`,
                        inlineMaskState,
                      )}
                    </blockquote>
                  ),
                  table: ({ node: _node, ...props }) => (
                    <div className={`exam-table-wrap ${SHARED_TABLE_WRAP_CLASS}`}>
                      <table {...props} />
                    </div>
                  ),
                  th: ({ node, children, ...props }) => (
                    <th {...props}>
                      {renderHelpTableCellContent({
                        node,
                        children,
                        keyPrefix: `${inlinePrefix}-th-${resolveMarkdownNodePositionKey(node, "th")}`,
                        markdownSource: preview.markdown,
                        inlineMaskState,
                        vaultPngAssets,
                        vaultPath,
                      })}
                    </th>
                  ),
                  td: ({ node, children, ...props }) => (
                    <td {...props}>
                      {renderHelpTableCellContent({
                        node,
                        children,
                        keyPrefix: `${inlinePrefix}-td-${resolveMarkdownNodePositionKey(node, "td")}`,
                        markdownSource: preview.markdown,
                        inlineMaskState,
                        vaultPngAssets,
                        vaultPath,
                      })}
                    </td>
                  ),
                }}
              >
                {preview.markdown}
              </ReactMarkdown>
                );
              })()}
            </div>
          </section>
        ))}
      </div>
      {onClose ? (
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
};

type HelpButtonProps = {
  helpText?: string[] | string | null;
  helpMarkdown?: string | null;
  enabled?: boolean;
  className?: string;
  label?: string;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
};

export const HelpButton = ({
  helpText,
  helpMarkdown,
  enabled = true,
  className,
  label = "Help / Hints",
  vaultPath,
  vaultPngAssets,
}: HelpButtonProps) => {
  const helpBlocks = useMemo(
    () => normalizeHelpBlocks(helpText, helpMarkdown),
    [helpMarkdown, helpText],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);
  const modalId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    return registerCloseLayer({
      id: `help-modal-${modalId}`,
      priority: 300,
      isActive: () => true,
      onClose: () => setIsOpen(false),
    });
  }, [isOpen, modalId]);

  useEffect(() => {
    if (!isOpen) {
      setActiveMaskId(null);
    }
  }, [isOpen]);

  if (!enabled || helpBlocks.length === 0) {
    return null;
  }

  const handleBackdropMouseDownCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (activeMaskId === null) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-help-inline-mask='true']")) {
      return;
    }
    setActiveMaskId(null);
  };

  const portalTarget = typeof document === "undefined" ? null : document.body;
  const modal = (
    <div
      className="modal-backdrop help-modal-backdrop"
      role="presentation"
      onMouseDownCapture={handleBackdropMouseDownCapture}
    >
      <HelpPanel
        helpBlocks={helpBlocks}
        title={label}
        onClose={() => setIsOpen(false)}
        activeMaskId={activeMaskId}
        onActiveMaskIdChange={setActiveMaskId}
        vaultPath={vaultPath}
        vaultPngAssets={vaultPngAssets}
      />
    </div>
  );
  const buttonClass = ["ghost small help-button", className].filter(Boolean).join(" ");

  return (
    <>
      <button
        type="button"
        className={buttonClass}
        onClick={() => setIsOpen(true)}
        aria-label={label}
        title={label}
      >
        <HelpIcon />
      </button>
      {isOpen ? (portalTarget ? createPortal(modal, portalTarget) : modal) : null}
    </>
  );
};
