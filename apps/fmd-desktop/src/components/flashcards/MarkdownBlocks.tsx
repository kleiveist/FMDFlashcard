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
import { splitMarkdownBlocks } from "../../lib/markdownTables";

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

type MarkdownBlocksProps = {
  text: string;
  className?: string;
  allowTableScroll?: boolean;
  renderPlaceholder?: (id: string) => ReactNode;
};

export const MarkdownBlocks = ({
  text,
  className,
  allowTableScroll = true,
  renderPlaceholder,
}: MarkdownBlocksProps) => {
  const blocks = splitMarkdownBlocks(text);
  const containerClass = ["flashcard-markdown", className]
    .filter(Boolean)
    .join(" ");
  const tableClass = [
    "flashcard-table",
    allowTableScroll ? "scrollable" : "no-scroll",
  ].join(" ");

  return (
    <div className={containerClass}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "table") {
          return (
            <div className={tableClass} key={`table-${blockIndex}`}>
              <table>
                <thead>
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th key={`head-${blockIndex}-${cellIndex}`}>
                        {renderTokens(
                          cell,
                          renderPlaceholder,
                          `table-head-${blockIndex}-${cellIndex}`,
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`row-${blockIndex}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${blockIndex}-${rowIndex}-${cellIndex}`}>
                          {renderTokens(
                            cell,
                            renderPlaceholder,
                            `table-cell-${blockIndex}-${rowIndex}-${cellIndex}`,
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

        return (
          <div className="flashcard-markdown-text" key={`text-${blockIndex}`}>
            {renderTokens(block.text, renderPlaceholder, `text-${blockIndex}`)}
          </div>
        );
      })}
    </div>
  );
};
