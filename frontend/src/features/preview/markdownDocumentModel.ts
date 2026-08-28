/**
 * @file frontend/src/features/preview/markdownDocumentModel.ts
 *
 * Purpose:
 * - Maintains a parse snapshot for markdown blocks.
 * - Applies incremental reparsing for changed markdown ranges.
 * - Falls back to full parse when incremental stitching is unsafe.
 */

import {
  assignCardGroupMeta,
  assignListGroupMeta,
  parseMarkdownBlocks,
  type MarkdownBlock,
  type MarkdownBlockParseProfile,
  type MarkdownBlockKind,
} from "./markdownBlocks";

export type MarkdownDiffRange = {
  changed: boolean;
  startOffset: number;
  endOffsetPrev: number;
  endOffsetNext: number;
};

export type MarkdownParseMode = "full" | "incremental" | "full-fallback";

export type MarkdownChangedBlockRange = {
  startIndex: number;
  endIndex: number;
} | null;

export type MarkdownDocumentSnapshot = {
  markdown: string;
  blocks: MarkdownBlock[];
  version: number;
  profile: MarkdownBlockParseProfile;
};

export type MarkdownParseStats = {
  mode: MarkdownParseMode;
  diffRange: MarkdownDiffRange;
  changedBlockRange: MarkdownChangedBlockRange;
};

export type MarkdownParseResult = {
  snapshot: MarkdownDocumentSnapshot;
  stats: MarkdownParseStats;
};

export type MarkdownDocumentParseOptions = {
  profile?: MarkdownBlockParseProfile;
};

type ReindexableBlock = {
  id: string;
  kind: MarkdownBlockKind;
  raw: string;
  startLine: number;
  meta?: MarkdownBlock["meta"];
};

const INCREMENTAL_CONTEXT_BLOCKS = 1;

const countNewlines = (value: string) => {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\n") {
      count += 1;
    }
  }
  return count;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const resolveProfile = (
  options: MarkdownDocumentParseOptions | undefined,
  fallbackProfile: MarkdownBlockParseProfile = "default",
) => options?.profile ?? fallbackProfile;

const offsetListMetaLineNumbers = (
  meta: MarkdownBlock["meta"] | undefined,
  lineOffset: number,
) => {
  if (!meta || lineOffset === 0 || meta.listParentStartLine === undefined) {
    return meta;
  }
  return {
    ...meta,
    listParentStartLine: meta.listParentStartLine + lineOffset,
  };
};

const resolveDiffRange = (previous: string, next: string): MarkdownDiffRange => {
  if (previous === next) {
    return {
      changed: false,
      startOffset: previous.length,
      endOffsetPrev: previous.length,
      endOffsetNext: next.length,
    };
  }

  const previousLength = previous.length;
  const nextLength = next.length;
  const minLength = Math.min(previousLength, nextLength);

  let startOffset = 0;
  while (startOffset < minLength && previous[startOffset] === next[startOffset]) {
    startOffset += 1;
  }

  let previousSuffixCursor = previousLength;
  let nextSuffixCursor = nextLength;
  while (
    previousSuffixCursor > startOffset &&
    nextSuffixCursor > startOffset &&
    previous[previousSuffixCursor - 1] === next[nextSuffixCursor - 1]
  ) {
    previousSuffixCursor -= 1;
    nextSuffixCursor -= 1;
  }

  return {
    changed: true,
    startOffset,
    endOffsetPrev: previousSuffixCursor,
    endOffsetNext: nextSuffixCursor,
  };
};

const resolveOverlappingRange = (
  blocks: MarkdownBlock[],
  diffRange: MarkdownDiffRange,
): MarkdownChangedBlockRange => {
  if (!diffRange.changed || blocks.length === 0) {
    return null;
  }

  const targetStart = diffRange.startOffset;
  const targetEndExclusive = Math.max(diffRange.startOffset, diffRange.endOffsetPrev);

  let startIndex = -1;
  let endIndex = -1;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const overlaps =
      block.endOffset >= targetStart &&
      block.startOffset <= targetEndExclusive;
    if (!overlaps) {
      continue;
    }
    if (startIndex < 0) {
      startIndex = index;
    }
    endIndex = index;
  }

  if (startIndex < 0 || endIndex < 0) {
    if (targetStart >= (blocks[blocks.length - 1]?.endOffset ?? 0)) {
      const index = blocks.length - 1;
      return { startIndex: index, endIndex: index };
    }
    return { startIndex: 0, endIndex: 0 };
  }

  return { startIndex, endIndex };
};

const reindexBlocks = (blocks: ReindexableBlock[]): MarkdownBlock[] => {
  if (blocks.length === 0) {
    return [];
  }

  const nextBlocks: MarkdownBlock[] = [];
  let offsetCursor = 0;
  let lineCursor = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const startOffset = offsetCursor;
    const endOffset = startOffset + block.raw.length;
    const lineCount = Math.max(1, countNewlines(block.raw) + 1);
    const startLine = lineCursor;
    const endLine = startLine + lineCount - 1;

    nextBlocks.push({
      id: block.id,
      kind: block.kind,
      raw: block.raw,
      meta: block.meta,
      startOffset,
      endOffset,
      startLine,
      endLine,
    });

    offsetCursor = endOffset;
    lineCursor = endLine;
    if (index < blocks.length - 1) {
      offsetCursor += 1;
      lineCursor += 1;
    }
  }

  return nextBlocks;
};

const toReindexable = (block: MarkdownBlock): ReindexableBlock => ({
  id: block.id,
  kind: block.kind,
  raw: block.raw,
  startLine: block.startLine,
  meta: block.meta,
});

const areBlockMetaEquivalent = (
  left: MarkdownBlock["meta"] | undefined,
  right: MarkdownBlock["meta"] | undefined,
) =>
  (left?.orderedDelimiter ?? null) === (right?.orderedDelimiter ?? null) &&
  (left?.unorderedMarker ?? null) === (right?.unorderedMarker ?? null) &&
  (left?.listGroupId ?? null) === (right?.listGroupId ?? null) &&
  (left?.listDepth ?? null) === (right?.listDepth ?? null) &&
  (left?.listIndentWidth ?? null) === (right?.listIndentWidth ?? null) &&
  (left?.listParentStartLine ?? null) === (right?.listParentStartLine ?? null) &&
  (left?.listItemType ?? null) === (right?.listItemType ?? null) &&
  (left?.cardGroupId ?? null) === (right?.cardGroupId ?? null) &&
  (left?.cardGroupRole ?? null) === (right?.cardGroupRole ?? null);

const areBlocksEquivalent = (
  left: Pick<ReindexableBlock, "kind" | "raw" | "meta">,
  right: Pick<ReindexableBlock, "kind" | "raw" | "meta">,
) =>
  left.kind === right.kind &&
  left.raw === right.raw &&
  areBlockMetaEquivalent(left.meta, right.meta);

const isBoundaryStable = (
  left: ReindexableBlock | null,
  right: ReindexableBlock | null,
  profile: MarkdownBlockParseProfile,
) => {
  if (!left || !right) {
    return true;
  }
  const lineOffset = left.startLine;
  const parsed = parseMarkdownBlocks([left.raw, right.raw].join("\n"), { profile });
  if (parsed.length !== 2) {
    return false;
  }
  const first = parsed[0]!;
  const second = parsed[1]!;
  const shiftedFirst: ReindexableBlock = {
    id: left.id,
    kind: first.kind,
    raw: first.raw,
    startLine: first.startLine + lineOffset,
    meta: offsetListMetaLineNumbers(first.meta, lineOffset),
  };
  const shiftedSecond: ReindexableBlock = {
    id: right.id,
    kind: second.kind,
    raw: second.raw,
    startLine: second.startLine + lineOffset,
    meta: offsetListMetaLineNumbers(second.meta, lineOffset),
  };
  return areBlocksEquivalent(left, shiftedFirst) && areBlocksEquivalent(right, shiftedSecond);
};

const resolveFullParseResult = (
  markdown: string,
  version: number,
  mode: MarkdownParseMode,
  diffRange: MarkdownDiffRange,
  profile: MarkdownBlockParseProfile,
): MarkdownParseResult => {
  const blocks = parseMarkdownBlocks(markdown, { profile });
  return {
    snapshot: {
      markdown,
      blocks,
      version,
      profile,
    },
    stats: {
      mode,
      diffRange,
      changedBlockRange:
        blocks.length > 0
          ? {
              startIndex: 0,
              endIndex: blocks.length - 1,
            }
          : null,
    },
  };
};

const resolveIncrementalSegmentIds = (
  parsedBlocks: MarkdownBlock[],
  nextVersion: number,
  lineOffset: number,
) =>
  parsedBlocks.map((block, index) => ({
    id: `mdh-inc:${nextVersion}:${index}:${block.kind}`,
    kind: block.kind,
    raw: block.raw,
    startLine: block.startLine + lineOffset,
    meta: offsetListMetaLineNumbers(block.meta, lineOffset),
  }));

export const createMarkdownDocumentSnapshot = (
  markdown: string,
  version = 0,
  options?: MarkdownDocumentParseOptions,
): MarkdownDocumentSnapshot => ({
  profile: resolveProfile(options),
  markdown,
  blocks: parseMarkdownBlocks(markdown, { profile: resolveProfile(options) }),
  version,
});

export const parseMarkdownDocument = (
  nextMarkdown: string,
  previousSnapshot: MarkdownDocumentSnapshot | null,
  nextVersion: number,
  options?: MarkdownDocumentParseOptions,
): MarkdownParseResult => {
  const profile = resolveProfile(options, previousSnapshot?.profile ?? "default");
  if (!previousSnapshot) {
    return resolveFullParseResult(
      nextMarkdown,
      nextVersion,
      "full",
      {
        changed: true,
        startOffset: 0,
        endOffsetPrev: 0,
        endOffsetNext: nextMarkdown.length,
      },
      profile,
    );
  }

  if (previousSnapshot.profile !== profile) {
    return resolveFullParseResult(
      nextMarkdown,
      nextVersion,
      "full",
      {
        changed: true,
        startOffset: 0,
        endOffsetPrev: previousSnapshot.markdown.length,
        endOffsetNext: nextMarkdown.length,
      },
      profile,
    );
  }

  const diffRange = resolveDiffRange(previousSnapshot.markdown, nextMarkdown);
  if (!diffRange.changed) {
    return {
      snapshot: {
        markdown: previousSnapshot.markdown,
        blocks: previousSnapshot.blocks,
        version: nextVersion,
        profile,
      },
      stats: {
        mode: "incremental",
        diffRange,
        changedBlockRange: null,
      },
    };
  }

  if (previousSnapshot.blocks.length === 0) {
    return resolveFullParseResult(nextMarkdown, nextVersion, "full-fallback", diffRange, profile);
  }

  const overlapRange = resolveOverlappingRange(previousSnapshot.blocks, diffRange);
  if (!overlapRange) {
    return resolveFullParseResult(nextMarkdown, nextVersion, "full-fallback", diffRange, profile);
  }

  const totalDelta = nextMarkdown.length - previousSnapshot.markdown.length;
  const lastPreviousIndex = previousSnapshot.blocks.length - 1;
  let reparsedStartIndex = clamp(
    overlapRange.startIndex - INCREMENTAL_CONTEXT_BLOCKS,
    0,
    lastPreviousIndex,
  );
  let reparsedEndIndex = clamp(
    overlapRange.endIndex + INCREMENTAL_CONTEXT_BLOCKS,
    0,
    lastPreviousIndex,
  );

  while (true) {
    const previousStartOffset = previousSnapshot.blocks[reparsedStartIndex]?.startOffset ?? 0;
    const previousEndOffset =
      previousSnapshot.blocks[reparsedEndIndex]?.endOffset ?? previousSnapshot.markdown.length;
    const nextEndOffset = clamp(
      previousEndOffset + totalDelta,
      previousStartOffset,
      nextMarkdown.length,
    );
    const nextSegmentSource = nextMarkdown.slice(previousStartOffset, nextEndOffset);
    const parsedSegment = parseMarkdownBlocks(nextSegmentSource, { profile });
    const segmentLineOffset = previousSnapshot.blocks[reparsedStartIndex]?.startLine ?? 0;

    const prefix = previousSnapshot.blocks.slice(0, reparsedStartIndex).map(toReindexable);
    const segment = resolveIncrementalSegmentIds(parsedSegment, nextVersion, segmentLineOffset);
    const suffix = previousSnapshot.blocks.slice(reparsedEndIndex + 1).map(toReindexable);
    const merged = [...prefix, ...segment, ...suffix];
    const reconstructedMarkdown = merged.map((block) => block.raw).join("\n");

    if (reconstructedMarkdown === nextMarkdown) {
      const segmentEndExclusive = reparsedStartIndex + segment.length;
      const boundariesAreStable = isBoundaryStable(
        merged[reparsedStartIndex - 1] ?? null,
        merged[reparsedStartIndex] ?? null,
        profile,
      ) && isBoundaryStable(
        merged[segmentEndExclusive - 1] ?? null,
        merged[segmentEndExclusive] ?? null,
        profile,
      );
      if (!boundariesAreStable) {
        if (reparsedStartIndex === 0 && reparsedEndIndex === lastPreviousIndex) {
          return resolveFullParseResult(nextMarkdown, nextVersion, "full-fallback", diffRange, profile);
        }
        reparsedStartIndex = Math.max(0, reparsedStartIndex - 1);
        reparsedEndIndex = Math.min(lastPreviousIndex, reparsedEndIndex + 1);
        continue;
      }

      const reindexedBlocks = assignCardGroupMeta(assignListGroupMeta(reindexBlocks(merged)));
      return {
        snapshot: {
          markdown: nextMarkdown,
          blocks: reindexedBlocks,
          version: nextVersion,
          profile,
        },
        stats: {
          mode: "incremental",
          diffRange,
          changedBlockRange:
            segment.length > 0
              ? {
                  startIndex: reparsedStartIndex,
                  endIndex: reparsedStartIndex + segment.length - 1,
                }
              : null,
        },
      };
    }

    if (reparsedStartIndex === 0 && reparsedEndIndex === lastPreviousIndex) {
      return resolveFullParseResult(nextMarkdown, nextVersion, "full-fallback", diffRange, profile);
    }

    reparsedStartIndex = Math.max(0, reparsedStartIndex - 1);
    reparsedEndIndex = Math.min(lastPreviousIndex, reparsedEndIndex + 1);
  }
};

export const __testOnly = {
  countNewlines,
  resolveDiffRange,
  resolveOverlappingRange,
  reindexBlocks,
};
