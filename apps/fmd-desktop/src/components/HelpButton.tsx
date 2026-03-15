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

import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from "react";
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
  vaultPngAssets,
  vaultPath,
}: {
  node: unknown;
  children: ReactNode;
  keyPrefix: string;
  markdownSource: string;
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
    return children;
  }

  return segments.map((segment, index) => {
    const segmentKey = `${keyPrefix}-segment-${index}`;
    if (segment.kind === "text") {
      return (
        <Fragment key={segmentKey}>
          {renderTextWithLineBreaks(segment.text, `${segmentKey}-text`)}
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
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
};

export const HelpPanel = ({
  helpBlocks,
  title = "Help / Hints",
  onClose,
  vaultPath,
  vaultPngAssets,
}: HelpPanelProps) => {
  const titleId = useId();

  return (
    <div
      className="modal-panel help-modal-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
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
                        keyPrefix: "help-th",
                        markdownSource: preview.markdown,
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
                        keyPrefix: "help-td",
                        markdownSource: preview.markdown,
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

  if (!enabled || helpBlocks.length === 0) {
    return null;
  }

  const portalTarget = typeof document === "undefined" ? null : document.body;
  const modal = (
    <div className="modal-backdrop" role="presentation">
      <HelpPanel
        helpBlocks={helpBlocks}
        title={label}
        onClose={() => setIsOpen(false)}
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
