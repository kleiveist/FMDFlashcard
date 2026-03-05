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

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { buildMarkdownMediaPreviewSource } from "../../../lib/cardMedia";
import { renderMarkdownMathNode } from "../../../lib/markdownMath";
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

export const ExamMarkdown = ({
  content,
  className,
  vaultPath,
  vaultPngAssets,
}: ExamMarkdownProps) => {
  const classes = ["exam-markdown", className].filter(Boolean).join(" ");
  const mediaPreview = buildMarkdownMediaPreviewSource(content, "exam-markdown");

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
            <div className="exam-table-wrap">
              <table {...props} />
            </div>
          ),
          th: ({ node: _node, children, ...props }) => (
            <th {...props}>{renderExamMathChildren(children, "exam-th")}</th>
          ),
          td: ({ node: _node, children, ...props }) => (
            <td {...props}>{renderExamMathChildren(children, "exam-td")}</td>
          ),
        }}
      >
        {mediaPreview.markdown}
      </ReactMarkdown>
    </div>
  );
};
