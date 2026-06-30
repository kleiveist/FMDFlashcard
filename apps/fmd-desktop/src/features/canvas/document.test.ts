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

  it("parses supported node kinds and shapes", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "file-a",
            type: "file",
            file: "docs/a.md",
            shape: "rectangle",
            x: 0,
            y: 0,
            width: 180,
            height: 90,
          },
          {
            id: "link-a",
            type: "link",
            url: "https://example.test",
            shape: "ellipse",
            x: 220,
            y: 0,
            width: 180,
            height: 90,
          },
        ],
        edges: [],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.document.nodes[0]?.type).toBe("file");
    expect(parsed.document.nodes[0]?.shape).toBe("rectangle");
    expect(parsed.document.nodes[1]?.url).toBe("https://example.test");
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

  it("fails when a node type is unsupported", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "unknown",
            x: 0,
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
    expect(parsed.error).toContain("type must be one of text/group/file/link");
  });

  it("fails when a node shape is unsupported", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "text",
            shape: "pill",
            x: 0,
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
    expect(parsed.error).toContain("shape must be one of");
  });

  it("fails when node ids are duplicated", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 80,
          },
          {
            id: "a",
            type: "text",
            x: 140,
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
    expect(parsed.error).toContain("duplicates an existing node id");
  });

  it("fails when edge ids are duplicated", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 80,
          },
          {
            id: "b",
            type: "text",
            x: 140,
            y: 0,
            width: 100,
            height: 80,
          },
        ],
        edges: [
          { id: "edge-a", fromNode: "a", toNode: "b" },
          { id: "edge-a", fromNode: "b", toNode: "a" },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.error).toContain("duplicates an existing edge id");
  });

  it("fails when a group reference points to a missing node", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "text",
            group: "missing-group",
            x: 0,
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
    expect(parsed.error).toContain("group references an unknown node id");
  });

  it("fails when a group reference points to a non-group node", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            id: "a",
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 80,
          },
          {
            id: "b",
            type: "text",
            group: "a",
            x: 140,
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
    expect(parsed.error).toContain("group must reference a group node");
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

  it("generates stable node ids when ids are missing", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [
          {
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 80,
          },
        ],
        edges: [],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.document.nodes[0]?.id).toBe("node-1");
  });

  it("preserves unknown root fields where possible", () => {
    const parsed = parseCanvasDocument(
      JSON.stringify({
        nodes: [],
        edges: [],
        metadata: { source: "test" },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.document.metadata).toEqual({ source: "test" });
    expect(serializeCanvasDocument(parsed.document)).toContain("\"metadata\"");
  });
});
