import { describe, expect, it } from "vitest";
import {
  extractCanvasBlockLineRanges,
  maskCanvasBlockLines,
  parseMarkdownCanvasBlock,
  replaceMarkdownCanvasBlockSource,
  serializeMarkdownCanvasBlock,
} from "./markdownBlockSyntax";

const sampleSource = JSON.stringify(
  {
    nodes: [
      {
        id: "node-1",
        type: "text",
        text: "# Example",
        x: 0,
        y: 0,
        width: 240,
        height: 120,
      },
    ],
    edges: [],
  },
  null,
  2,
);

describe("markdown Canvas block syntax", () => {
  it("parses directive Canvas blocks", () => {
    const raw = ["#canvas", sampleSource, "#canvasend"].join("\n");

    const parsed = parseMarkdownCanvasBlock(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.block.format).toBe("directive");
    expect(parsed.document.nodes[0]?.text).toBe("# Example");
  });

  it("parses fenced Canvas blocks", () => {
    const raw = ["```canvas", sampleSource, "```"].join("\n");

    const parsed = parseMarkdownCanvasBlock(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.block.format).toBe("fenced");
    expect(parsed.document.nodes).toHaveLength(1);
  });

  it("serializes Canvas blocks back to directive Markdown", () => {
    const parsed = parseMarkdownCanvasBlock(["#canvas", sampleSource, "#canvasend"].join("\n"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const serialized = serializeMarkdownCanvasBlock(parsed.document);

    expect(serialized).toContain("#canvas\n");
    expect(serialized).toContain("\n#canvasend");
    expect(serialized).toContain("\"nodes\"");
  });

  it("replaces only the Canvas JSON body while preserving fenced wrappers", () => {
    const raw = ["```canvas", sampleSource, "```"].join("\n");
    const nextRaw = replaceMarkdownCanvasBlockSource(
      raw,
      JSON.stringify({ nodes: [], edges: [] }, null, 2),
    );

    expect(nextRaw.startsWith("```canvas\n")).toBe(true);
    expect(nextRaw.endsWith("\n```")).toBe(true);
    expect(nextRaw).toContain("\"edges\": []");
  });

  it("extracts and masks multiple Canvas blocks", () => {
    const lines = [
      "Before",
      "#canvas",
      sampleSource,
      "#canvasend",
      "Between",
      "```canvas",
      "{ \"nodes\": [], \"edges\": [] }",
      "```",
      "After",
    ];

    expect(extractCanvasBlockLineRanges(lines)).toEqual([
      { startLine: 1, endLine: 3 },
      { startLine: 5, endLine: 7 },
    ]);
    expect(maskCanvasBlockLines(lines)).toEqual([
      "Before",
      "",
      "",
      "",
      "Between",
      "",
      "",
      "",
      "After",
    ]);
  });
});
