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

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { buildMarkdownMediaPreviewSource } from "../../../lib/cardMedia";
import type { VaultPngAsset } from "../../../lib/tree";
import { FlashcardMediaGroup } from "../../../components/flashcards/FlashcardMediaGroup";
import { SvgPreviewBlock } from "../../../components/flashcards/SvgPreviewBlock";
import { extractSvgCodeBlockSource } from "../../../components/markdownSvg";

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
          div: ({ node, ...props }) => {
            const mediaBlockMarker = readMarkdownElementProperty(node, "data-fmd-media-block");
            if (typeof mediaBlockMarker === "undefined") {
              return <div {...props} />;
            }
            const mediaIndexRaw = readMarkdownElementProperty(node, "data-media-index");
            const mediaIndex = Number.parseInt(
              String(mediaIndexRaw ?? ""),
              10,
            );
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
            return <pre {...props}>{children}</pre>;
          },
          table: ({ node: _node, ...props }) => (
            <div className="exam-table-wrap">
              <table {...props} />
            </div>
          ),
        }}
      >
        {mediaPreview.markdown}
      </ReactMarkdown>
    </div>
  );
};
