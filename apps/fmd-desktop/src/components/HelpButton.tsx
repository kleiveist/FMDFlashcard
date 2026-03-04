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

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { buildMarkdownMediaPreviewSource } from "../lib/cardMedia";
import type { VaultPngAsset } from "../lib/tree";
import { HelpIcon } from "./icons";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import { FlashcardMediaGroup } from "./flashcards/FlashcardMediaGroup";
import { SvgPreviewBlock } from "./flashcards/SvgPreviewBlock";
import { extractSvgCodeBlockSource } from "./markdownSvg";

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
                    if (typeof mediaBlockMarker === "undefined") {
                      return <div {...props} />;
                    }
                    const mediaIndexRaw = readMarkdownElementProperty(node, "data-media-index");
                    const mediaIndex = Number.parseInt(
                      String(mediaIndexRaw ?? ""),
                      10,
                    );
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
                    return <pre {...props}>{children}</pre>;
                  },
                  table: ({ node: _node, ...props }) => (
                    <div className="exam-table-wrap">
                      <table {...props} />
                    </div>
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
