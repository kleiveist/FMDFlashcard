/**
 * @file apps/fmd-desktop/src/components/flashcards/MarkdownBlocks.tsx
 *
 * Zweck:
 * - Rendert einfache Markdown-Bloecke mit Tabellenunterstuetzung.
 *
 * Hinweise:
 * - Tabellen werden als pipe tables erkannt.
 * - Platzhalter fuer Cloze-Token koennen via renderPlaceholder ersetzt werden.
 */

import { Fragment, type ReactNode } from "react";
import { splitMarkdownBlocks, type MarkdownBlock } from "../../lib/markdownTables";
import { splitMarkdownMediaSegments } from "../../lib/cardMedia";
import type { VaultPngAsset } from "../../lib/tree";
import { FlashcardMediaGroup } from "./FlashcardMediaGroup";

export const CLOZE_PLACEHOLDER_PREFIX = "@@@CLOZE:";
export const CLOZE_PLACEHOLDER_SUFFIX = "@@@";

const buildPlaceholder = (id: string) =>
  `${CLOZE_PLACEHOLDER_PREFIX}${id}${CLOZE_PLACEHOLDER_SUFFIX}`;

type Token =
  | { type: "text"; value: string }
  | { type: "br" }
  | { type: "placeholder"; id: string };

const tokenRegex = /@@@CLOZE:([^@]+?)@@@|<br\s*\/?>/gi;

const tokenizeText = (value: string) => {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  tokenRegex.lastIndex = 0;

  while ((match = tokenRegex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: value.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      tokens.push({ type: "placeholder", id: match[1] });
    } else {
      tokens.push({ type: "br" });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    tokens.push({ type: "text", value: value.slice(lastIndex) });
  }

  return tokens;
};

const renderTokens = (
  value: string,
  renderPlaceholder: ((id: string) => ReactNode) | undefined,
  keyPrefix: string,
) =>
  tokenizeText(value).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.type === "text") {
      return token.value;
    }
    if (token.type === "br") {
      return <br key={key} />;
    }
    if (!renderPlaceholder) {
      return buildPlaceholder(token.id);
    }
    const rendered = renderPlaceholder(token.id);
    if (rendered === null || rendered === undefined) {
      return buildPlaceholder(token.id);
    }
    return <Fragment key={key}>{rendered}</Fragment>;
  });

type MarkdownFenceBlock =
  | { type: "code"; text: string; language: string }
  | { type: "text"; text: string };

const normalizeLineBreaks = (value: string) => value.replace(/\r\n?/g, "\n");

const splitFenceBlocks = (rawText: string): MarkdownFenceBlock[] => {
  const lines = normalizeLineBreaks(rawText).split("\n");
  const blocks: MarkdownFenceBlock[] = [];
  const textBuffer: string[] = [];
  const codeBuffer: string[] = [];
  let inFence = false;
  let fenceLanguage = "";
  const fencePattern = /^(```|~~~)(.*)$/;

  const flushText = () => {
    if (textBuffer.length === 0) {
      return;
    }
    blocks.push({ type: "text", text: textBuffer.join("\n") });
    textBuffer.length = 0;
  };

  const flushCode = () => {
    blocks.push({ type: "code", text: codeBuffer.join("\n"), language: fenceLanguage });
    codeBuffer.length = 0;
    fenceLanguage = "";
  };

  lines.forEach((line) => {
    const trimmed = line.trimStart();
    const match = trimmed.match(fencePattern);
    if (match) {
      if (inFence) {
        flushCode();
        inFence = false;
      } else {
        flushText();
        inFence = true;
        fenceLanguage = match[2]?.trim() ?? "";
      }
      return;
    }
    if (inFence) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  });

  if (inFence) {
    flushCode();
  } else {
    flushText();
  }

  return blocks;
};

type MarkdownBlocksProps = {
  text: string;
  className?: string;
  allowTableScroll?: boolean;
  renderPlaceholder?: (id: string) => ReactNode;
  vaultPath?: string | null;
  vaultPngAssets?: VaultPngAsset[] | null;
};

export const MarkdownBlocks = ({
  text,
  className,
  allowTableScroll = true,
  renderPlaceholder,
  vaultPath,
  vaultPngAssets,
}: MarkdownBlocksProps) => {
  const segments = splitMarkdownMediaSegments(text, "flashcard-markdown");
  const containerClass = ["flashcard-markdown", className]
    .filter(Boolean)
    .join(" ");
  const tableClass = [
    "flashcard-table",
    allowTableScroll ? "scrollable" : "no-scroll",
  ].join(" ");

  return (
    <div className={containerClass}>
      {segments.map((segment, segmentIndex) => {
        if (segment.kind === "media") {
          return (
            <FlashcardMediaGroup
              key={`media-${segmentIndex}`}
              media={segment.items}
              vaultPngAssets={vaultPngAssets}
              vaultPath={vaultPath}
            />
          );
        }

        const fencedBlocks = splitFenceBlocks(segment.source);
        const blocks: Array<MarkdownBlock | MarkdownFenceBlock> = [];
        fencedBlocks.forEach((block) => {
          if (block.type === "code") {
            blocks.push(block);
            return;
          }
          splitMarkdownBlocks(block.text).forEach((nested) => {
            blocks.push(nested);
          });
        });

        return blocks.map((block, blockIndex) => {
          const keyPrefix = `${segmentIndex}-${blockIndex}`;
          if (block.type === "table") {
            return (
              <div className={tableClass} key={`table-${keyPrefix}`}>
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={`head-${keyPrefix}-${cellIndex}`}>
                          {renderTokens(
                            cell,
                            renderPlaceholder,
                            `table-head-${keyPrefix}-${cellIndex}`,
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`row-${keyPrefix}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${keyPrefix}-${rowIndex}-${cellIndex}`}>
                            {renderTokens(
                              cell,
                              renderPlaceholder,
                              `table-cell-${keyPrefix}-${rowIndex}-${cellIndex}`,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          if (block.type === "code") {
            const codeClass = [
              "flashcard-code-block",
              block.language ? `language-${block.language}` : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <pre className={codeClass} key={`code-${keyPrefix}`}>
                <code>
                  {renderTokens(block.text, renderPlaceholder, `code-${keyPrefix}`)}
                </code>
              </pre>
            );
          }

          return (
            <div className="flashcard-markdown-text" key={`text-${keyPrefix}`}>
              {renderTokens(block.text, renderPlaceholder, `text-${keyPrefix}`)}
            </div>
          );
        });
      })}
    </div>
  );
};
