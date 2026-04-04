import { describe, expect, it } from "vitest";
import { sortNodes, type TreeNode } from "./tree";

describe("sortNodes", () => {
  it("keeps directories before files and sorts both naturally", () => {
    const nodes: TreeNode[] = [
      { name: "10.md", path: "10.md", type: "file" },
      { name: "2-folder", path: "2-folder", type: "dir", children: [] },
      { name: "2.md", path: "2.md", type: "file" },
      { name: "10-folder", path: "10-folder", type: "dir", children: [] },
      { name: "1.md", path: "1.md", type: "file" },
      { name: "1-folder", path: "1-folder", type: "dir", children: [] },
    ];

    const sorted = sortNodes(nodes);
    expect(sorted.map((node) => `${node.type}:${node.name}`)).toEqual([
      "dir:1-folder",
      "dir:2-folder",
      "dir:10-folder",
      "file:1.md",
      "file:2.md",
      "file:10.md",
    ]);
  });

  it("sorts nested directory children naturally", () => {
    const nodes: TreeNode[] = [
      {
        name: "root",
        path: "root",
        type: "dir",
        children: [
          { name: "10.md", path: "root/10.md", type: "file" },
          { name: "2.md", path: "root/2.md", type: "file" },
          { name: "1.md", path: "root/1.md", type: "file" },
        ],
      },
    ];

    const sorted = sortNodes(nodes);
    expect(sorted[0]?.children?.map((child) => child.name)).toEqual(["1.md", "2.md", "10.md"]);
  });
});
