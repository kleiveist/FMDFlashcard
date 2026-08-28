/**
 * @file frontend/src/features/preview/database/database-view-segments.ts
 *
 * Splits markdown-view content into regular markdown and embedded database blocks.
 */

import { parseMarkdownBlocks } from "../markdownBlocks";

export type DatabaseViewSegment =
  | {
      key: string;
      type: "markdown";
      markdown: string;
    }
  | {
      key: string;
      type: "database-block";
      raw: string;
    };

export const splitDatabaseViewSegments = (markdown: string): DatabaseViewSegment[] | null => {
  if (!markdown.trim()) {
    return null;
  }

  const blocks = parseMarkdownBlocks(markdown);
  const databaseBlocks = blocks.filter((block) => block.kind === "database-block");
  if (databaseBlocks.length === 0) {
    return null;
  }

  const segments: DatabaseViewSegment[] = [];
  let cursor = 0;

  databaseBlocks.forEach((block, index) => {
    if (block.startOffset > cursor) {
      const leading = markdown.slice(cursor, block.startOffset);
      if (leading.length > 0) {
        segments.push({
          key: `md-${index}-${cursor}`,
          type: "markdown",
          markdown: leading,
        });
      }
    }

    segments.push({
      key: `db-${index}-${block.startOffset}`,
      type: "database-block",
      raw: block.raw,
    });
    cursor = block.endOffset;
  });

  if (cursor < markdown.length) {
    const trailing = markdown.slice(cursor);
    if (trailing.length > 0) {
      segments.push({
        key: `md-tail-${cursor}`,
        type: "markdown",
        markdown: trailing,
      });
    }
  }

  return segments;
};
