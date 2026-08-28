import { describe, expect, it } from "vitest";
import { __markdownHybridEditorTestables } from "./MarkdownHybridEditor";
import { type MarkdownBlock } from "./markdownBlocks";

const createBlock = (
  overrides: Partial<MarkdownBlock> & Pick<MarkdownBlock, "id" | "kind" | "startLine" | "endLine">,
): MarkdownBlock => ({
  id: overrides.id,
  kind: overrides.kind,
  startLine: overrides.startLine,
  endLine: overrides.endLine,
  startOffset: overrides.startOffset ?? overrides.startLine * 10,
  endOffset: overrides.endOffset ?? overrides.endLine * 10,
  raw: overrides.raw ?? "",
  meta: overrides.meta,
});

describe("MarkdownHybridEditor render key assignment", () => {
  it("keeps render key stable for database blocks when end line changes", () => {
    const { assignStableRenderKeys } = __markdownHybridEditorTestables;
    const counter = { current: 0 };

    const initialBlock = createBlock({
      id: "0:database-block:10:20",
      kind: "database-block",
      startLine: 10,
      endLine: 20,
      raw: "::::\nview:\n  type: table\n::::",
    });
    const first = assignStableRenderKeys([initialBlock], [], counter);

    const updatedBlock = createBlock({
      id: "0:database-block:10:27",
      kind: "database-block",
      startLine: 10,
      endLine: 27,
      raw: "::::\nview:\n  type: table\nfilters:\n  op: and\n::::",
    });
    const second = assignStableRenderKeys([updatedBlock], first.tokens, counter);

    expect(second.keys[0]).toBe(first.keys[0]);
  });

  it("still remounts non-database blocks when block id changes", () => {
    const { assignStableRenderKeys } = __markdownHybridEditorTestables;
    const counter = { current: 0 };

    const initialBlock = createBlock({
      id: "0:paragraph:10:10",
      kind: "paragraph",
      startLine: 10,
      endLine: 10,
      raw: "alpha",
    });
    const first = assignStableRenderKeys([initialBlock], [], counter);

    const updatedBlock = createBlock({
      id: "0:paragraph:10:11",
      kind: "paragraph",
      startLine: 10,
      endLine: 11,
      raw: "alpha\nbeta",
    });
    const second = assignStableRenderKeys([updatedBlock], first.tokens, counter);

    expect(second.keys[0]).not.toBe(first.keys[0]);
  });
});
