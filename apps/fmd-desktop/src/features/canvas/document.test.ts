import { describe, expect, it } from "vitest";
import {
  createEmptyCanvasDocument,
  parseCanvasDocument,
  serializeCanvasDocument,
} from "./document";

describe("canvas document parser", () => {
  it("parses valid nodes, groups and edges", () => {
    const source = JSON.stringify({
      nodes: [
        {
          id: "group-a",
          type: "group",
          x: 10,
          y: 20,
          width: 400,
          height: 250,
          label: "Core",
          color: "#2f80ed",
        },
        {
          id: "node-a",
          type: "text",
          group: "group-a",
          x: 50,
          y: 70,
          width: 180,
          height: 100,
          text: "# Nextcloud",
        },
      ],
      edges: [
        {
          id: "edge-a",
          fromNode: "node-a",
          toNode: "group-a",
          fromSide: "right",
          toSide: "left",
          toEnd: "arrow",
          label: "VPN",
        },
      ],
    });

    const parsed = parseCanvasDocument(source);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.document.nodes).toHaveLength(2);
    expect(parsed.document.edges).toHaveLength(1);
    expect(parsed.document.nodes[1]?.text).toContain("Nextcloud");
    expect(parsed.document.edges[0]?.toEnd).toBe("arrow");
  });

  it("fails when nodes array is missing", () => {
    const parsed = parseCanvasDocument(JSON.stringify({ edges: [] }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.error).toContain("nodes array");
  });

  it("fails when a node coordinate is invalid", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "text",
            x: "12",
            y: 0,
            width: 100,
            height: 80,
          },
        ],
        edges: [],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.error).toContain("nodes[0].x");
  });

  it("fails when an edge points to an unknown node", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "text",
            x: 0,
            y: 0,
            width: 80,
            height: 50,
          },
        ],
        edges: [
          {
            fromNode: "a",
            toNode: "missing-node",
          },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.error).toContain("unknown node id");
  });

  it("serializes with trailing newline", () => {
    const serialized = serializeCanvasDocument(createEmptyCanvasDocument());
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized).toContain("\"nodes\": []");
  });
});

