import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "./markdownBlocks";
import {
  __testOnly,
  createMarkdownDocumentSnapshot,
  parseMarkdownDocument,
} from "./markdownDocumentModel";

const toComparableBlocks = (
  markdown: string,
  profile: "default" | "hybrid-list-items" = "default",
) =>
  parseMarkdownBlocks(markdown, { profile }).map((block) => ({
    kind: block.kind,
    raw: block.raw,
    startLine: block.startLine,
    endLine: block.endLine,
    startOffset: block.startOffset,
    endOffset: block.endOffset,
    meta: block.meta,
  }));

const createDeterministicRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const randomInt = (random: () => number, maxExclusive: number) =>
  Math.floor(random() * maxExclusive);

const mutateMarkdown = (value: string, random: () => number) => {
  const operation = randomInt(random, 3);
  const chars = "abcdefghijklmnopqrstuvwxyz\n #-*0123456789";

  if (operation === 0 || value.length === 0) {
    const insertAt = randomInt(random, value.length + 1);
    const insertLength = 1 + randomInt(random, 4);
    let insertion = "";
    for (let index = 0; index < insertLength; index += 1) {
      insertion += chars[randomInt(random, chars.length)] ?? "a";
    }
    return `${value.slice(0, insertAt)}${insertion}${value.slice(insertAt)}`;
  }

  if (operation === 1) {
    const removeStart = randomInt(random, value.length);
    const removeLength = Math.min(value.length - removeStart, 1 + randomInt(random, 4));
    return `${value.slice(0, removeStart)}${value.slice(removeStart + removeLength)}`;
  }

  const replaceStart = randomInt(random, value.length);
  const replaceLength = Math.min(value.length - replaceStart, 1 + randomInt(random, 4));
  const replacementLength = 1 + randomInt(random, 4);
  let replacement = "";
  for (let index = 0; index < replacementLength; index += 1) {
    replacement += chars[randomInt(random, chars.length)] ?? "b";
  }
  return `${value.slice(0, replaceStart)}${replacement}${value.slice(replaceStart + replaceLength)}`;
};

describe("markdownDocumentModel", () => {
  it("computes stable diff ranges", () => {
    const diff = __testOnly.resolveDiffRange("abcDEFghi", "abcXYZghi");
    expect(diff).toEqual({
      changed: true,
      startOffset: 3,
      endOffsetPrev: 6,
      endOffsetNext: 6,
    });
  });

  it("keeps incremental parse output equivalent to full parse across edit sequences", () => {
    const random = createDeterministicRandom(0x5a17c9ef);
    let markdown = [
      "# Title",
      "",
      "1) First task",
      "Answer: a",
      "",
      "#card",
      "Prompt",
      "Answer: result",
      "#endcard",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");

    let snapshot = createMarkdownDocumentSnapshot(markdown, 0);

    for (let version = 1; version <= 120; version += 1) {
      markdown = mutateMarkdown(markdown, random);
      const next = parseMarkdownDocument(markdown, snapshot, version);
      const comparable = next.snapshot.blocks.map((block) => ({
        kind: block.kind,
        raw: block.raw,
        startLine: block.startLine,
        endLine: block.endLine,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        meta: block.meta,
      }));

      expect(comparable).toEqual(toComparableBlocks(markdown));
      snapshot = next.snapshot;
    }
  });

  it("falls back safely when incremental stitching cannot match the source", () => {
    const initial = ["Para", "", "#card", "Question", "Answer: A", "#endcard", "", "Outro"].join(
      "\n",
    );

    const snapshot = createMarkdownDocumentSnapshot(initial, 0);
    const nextMarkdown = [
      "Para",
      "",
      "#card",
      "Question",
      "Answer: A",
      "---",
      "#endcard",
      "",
      "Outro",
      "1) Tail",
    ].join("\n");

    const result = parseMarkdownDocument(nextMarkdown, snapshot, 1);
    expect(result.snapshot.blocks.map((block) => block.raw).join("\n")).toBe(nextMarkdown);
    expect(
      result.snapshot.blocks.map((block) => ({
        kind: block.kind,
        raw: block.raw,
        startLine: block.startLine,
        endLine: block.endLine,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        meta: block.meta,
      })),
    ).toEqual(toComparableBlocks(nextMarkdown));
  });

  it("keeps incremental parse output equivalent in hybrid-list-items profile", () => {
    const random = createDeterministicRandom(0xa5fe19bc);
    let markdown = [
      "1. Root",
      "   1. Child A",
      "   2. Child B",
      "2. Root 2",
      "",
      "- [ ] Task A",
      "- [x] Task B",
      "",
      "Tail paragraph",
    ].join("\n");

    let snapshot = createMarkdownDocumentSnapshot(markdown, 0, { profile: "hybrid-list-items" });

    for (let version = 1; version <= 120; version += 1) {
      markdown = mutateMarkdown(markdown, random);
      const next = parseMarkdownDocument(markdown, snapshot, version, {
        profile: "hybrid-list-items",
      });
      const comparable = next.snapshot.blocks.map((block) => ({
        kind: block.kind,
        raw: block.raw,
        startLine: block.startLine,
        endLine: block.endLine,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        meta: block.meta,
      }));

      expect(comparable).toEqual(toComparableBlocks(markdown, "hybrid-list-items"));
      snapshot = next.snapshot;
    }
  });

  it("switches to full parse when parser profile changes", () => {
    const markdown = ["1. One", "2. Two", "After"].join("\n");
    const previousSnapshot = createMarkdownDocumentSnapshot(markdown, 0, {
      profile: "default",
    });

    const result = parseMarkdownDocument(markdown, previousSnapshot, 1, {
      profile: "hybrid-list-items",
    });

    expect(result.stats.mode).toBe("full");
    expect(result.snapshot.profile).toBe("hybrid-list-items");
    expect(result.snapshot.blocks.map((block) => block.kind)).toEqual([
      "ordered-list",
      "ordered-list",
      "paragraph",
    ]);
  });
});
