/**
 * @file apps/fmd-desktop/src/pages/exam-simulation/components/ExamMarkdown.tsx
 *
 * Zweck:
 * - Rendert die Seite Exam Markdown.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - react-markdown: Externe Bibliothek.
 * - rehype-sanitize: Externe Bibliothek.
 *
 * Exportiert:
 * - ExamMarkdown: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { buildMarkdownMediaPreviewSource } from "../../../lib/cardMedia";
import {
  resolveMarkdownTableCellSegments,
  SHARED_TABLE_CELL_IMAGE_CLASS,
  SHARED_TABLE_CELL_MEDIA_CLASS,
  SHARED_TABLE_WRAP_CLASS,
} from "../../../lib/markdownTableCellMedia";
import { renderMarkdownMathNode } from "../../../lib/markdownMath";
import { escapeDotOrderedListMarkers } from "../../../lib/markdownOrderedListMarkers";
import type { VaultPngAsset } from "../../../lib/tree";
import { FlashcardMediaGroup } from "../../../components/flashcards/FlashcardMediaGroup";
import { SvgPreviewBlock } from "../../../components/flashcards/SvgPreviewBlock";
import { extractSvgCodeBlockSource } from "../../../components/markdownSvg";
import { MarkdownHighlightedPre } from "../../../components/MarkdownHighlightedPre";

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

type ExamMarkdownProps = {
  content: string;
  className?: string;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
};

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

const shouldSkipExamMathTransform = (tagName: string | null) =>
  tagName === "code" ||
  tagName === "pre" ||
  tagName === "kbd" ||
  tagName === "samp" ||
  tagName === "svg" ||
  tagName === "path" ||
  tagName === "button" ||
  tagName === "input" ||
  tagName === "textarea";

const renderExamMathInNode = (node: ReactNode, keyPrefix = "exam-md-math"): ReactNode => {
  if (typeof node === "string") {
    const rendered = renderMarkdownMathNode(node, { keyPrefix });
    if (rendered.length === 1) {
      return rendered[0] ?? null;
    }
    return rendered;
  }
  if (typeof node === "number" || typeof node === "boolean" || node == null) {
    return node;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }
  const tagName = typeof node.type === "string" ? node.type.toLowerCase() : null;
  if (shouldSkipExamMathTransform(tagName)) {
    return node;
  }
  const rawChildren = node.props.children;
  if (rawChildren == null) {
    return node;
  }
  const nextChildren = Children.map(rawChildren, (child, index) =>
    renderExamMathInNode(child, `${keyPrefix}-${index}`),
  );
  return cloneElement(node, undefined, nextChildren);
};

const renderExamMathChildren = (children: ReactNode, keyPrefix: string) =>
  Children.map(children, (child, index) =>
    renderExamMathInNode(child, `${keyPrefix}-${index}`),
  );

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

const renderExamTableCellContent = ({
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
    scope: `exam-table-cell-${keyPrefix}`,
  });
  const hasMediaSegments = segments.some((segment) => segment.kind !== "text");
  if (!hasMediaSegments) {
    return renderExamMathChildren(children, keyPrefix);
  }

  const segmentNodes = segments.map((segment, index) => {
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
          className={`exam-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
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
        className={`exam-table-cell-media ${SHARED_TABLE_CELL_MEDIA_CLASS}`}
        key={segmentKey}
      >
        <img
          src={segment.src}
          alt={segment.alt ?? ""}
          title={segment.title}
          className={`exam-table-cell-image ${SHARED_TABLE_CELL_IMAGE_CLASS}`}
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  });

  return renderExamMathChildren(segmentNodes, `${keyPrefix}-rich`);
};

export const ExamMarkdown = ({
  content,
  className,
  vaultPath,
  vaultPngAssets,
}: ExamMarkdownProps) => {
  const classes = ["exam-markdown", className].filter(Boolean).join(" ");
  const previewContent = escapeDotOrderedListMarkers(content);
  const mediaPreview = buildMarkdownMediaPreviewSource(previewContent, "exam-markdown");

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
        components={{
          h1: ({ node: _node, children, ...props }) => (
            <h1 {...props}>{renderExamMathChildren(children, "exam-h1")}</h1>
          ),
          h2: ({ node: _node, children, ...props }) => (
            <h2 {...props}>{renderExamMathChildren(children, "exam-h2")}</h2>
          ),
          h3: ({ node: _node, children, ...props }) => (
            <h3 {...props}>{renderExamMathChildren(children, "exam-h3")}</h3>
          ),
          h4: ({ node: _node, children, ...props }) => (
            <h4 {...props}>{renderExamMathChildren(children, "exam-h4")}</h4>
          ),
          h5: ({ node: _node, children, ...props }) => (
            <h5 {...props}>{renderExamMathChildren(children, "exam-h5")}</h5>
          ),
          h6: ({ node: _node, children, ...props }) => (
            <h6 {...props}>{renderExamMathChildren(children, "exam-h6")}</h6>
          ),
          p: ({ node: _node, children, ...props }) => (
            <p {...props}>{renderExamMathChildren(children, "exam-p")}</p>
          ),
          li: ({ node: _node, children, ...props }) => (
            <li {...props}>{renderExamMathChildren(children, "exam-li")}</li>
          ),
          blockquote: ({ node: _node, children, ...props }) => (
            <blockquote {...props}>{renderExamMathChildren(children, "exam-blockquote")}</blockquote>
          ),
          div: ({ node, children, ...props }) => {
            const mediaBlockMarker = readMarkdownElementProperty(node, "data-fmd-media-block");
            const placeholderMatch = readMarkdownNodeText(node).match(mediaPlaceholderTextPattern);
            const placeholderIndex = placeholderMatch
              ? Number.parseInt(placeholderMatch[1] ?? "", 10)
              : Number.NaN;
            const hasPlaceholderIndex = Number.isFinite(placeholderIndex);
            if (typeof mediaBlockMarker === "undefined" && !hasPlaceholderIndex) {
              return <div {...props}>{renderExamMathChildren(children, "exam-div")}</div>;
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
              ? (mediaPreview.groups[mediaIndex] ?? null)
              : (mediaPreview.groups.length === 1 ? mediaPreview.groups[0] ?? null : null);
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
          th: ({ node: _node, children, ...props }) => (
            <th {...props}>
              {renderExamTableCellContent({
                node: _node,
                children,
                keyPrefix: "exam-th",
                markdownSource: mediaPreview.markdown,
                vaultPngAssets,
                vaultPath,
              })}
            </th>
          ),
          td: ({ node: _node, children, ...props }) => (
            <td {...props}>
              {renderExamTableCellContent({
                node: _node,
                children,
                keyPrefix: "exam-td",
                markdownSource: mediaPreview.markdown,
                vaultPngAssets,
                vaultPath,
              })}
            </td>
          ),
        }}
      >
        {mediaPreview.markdown}
      </ReactMarkdown>
    </div>
  );
};
