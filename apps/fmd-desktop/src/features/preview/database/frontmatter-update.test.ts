import { describe, expect, it } from "vitest";
import {
  bulkUpsertDatabaseAttribute,
  mapDatabaseFieldTypeToFrontmatterKind,
  upsertFrontmatterAttributeInMarkdown,
} from "./frontmatter-update";

describe("frontmatter-update", () => {
  it("maps database field types to frontmatter kinds", () => {
    expect(mapDatabaseFieldTypeToFrontmatterKind("number")).toBe("number");
    expect(mapDatabaseFieldTypeToFrontmatterKind("boolean")).toBe("boolean");
    expect(mapDatabaseFieldTypeToFrontmatterKind("tags")).toBe("tags");
    expect(mapDatabaseFieldTypeToFrontmatterKind("link")).toBe("link");
    expect(mapDatabaseFieldTypeToFrontmatterKind("date")).toBe("text");
  });

  it("adds an attribute and creates frontmatter when missing", () => {
    const source = "# Heading\n\nBody";
    const result = upsertFrontmatterAttributeInMarkdown({
      markdown: source,
      key: "Section",
      type: "text",
      initialValue: "IUFS",
      overwriteExisting: false,
    });

    expect(result.error).toBeNull();
    expect(result.action).toBe("added");
    expect(result.markdown).toContain("Section: IUFS");
    expect((result.markdown.match(/^---$/gm) ?? []).length).toBe(2);
  });

  it("updates existing key case-insensitively", () => {
    const source = [
      "---",
      "section: old",
      "other: stay",
      "---",
      "Body",
    ].join("\n");

    const result = upsertFrontmatterAttributeInMarkdown({
      markdown: source,
      key: "Section",
      type: "text",
      initialValue: "new",
      overwriteExisting: true,
    });

    expect(result.error).toBeNull();
    expect(result.action).toBe("updated");
    expect(result.markdown).toContain("section: new");
    expect(result.markdown).toContain("other: stay");
  });

  it("skips existing key when overwrite is disabled", () => {
    const source = [
      "---",
      "Section: old",
      "---",
      "Body",
    ].join("\n");

    const result = upsertFrontmatterAttributeInMarkdown({
      markdown: source,
      key: "section",
      type: "text",
      initialValue: "new",
      overwriteExisting: false,
    });

    expect(result.error).toBeNull();
    expect(result.action).toBe("skipped");
    expect(result.changed).toBe(false);
    expect(result.markdown).toBe(source);
  });

  it("bulk upserts attributes with injected io", async () => {
    const files = [
      { path: "/tmp/a.md", relativePath: "a.md" },
      { path: "/tmp/b.md", relativePath: "b.md" },
    ];

    const storage: Record<string, string> = {
      "/tmp/a.md": "# A",
      "/tmp/b.md": ["---", "Section: B", "---", "Body"].join("\n"),
    };

    const writes: Record<string, string> = {};

    const result = await bulkUpsertDatabaseAttribute({
      files,
      key: "Section",
      type: "text",
      initialValue: "IUFS",
      overwriteExisting: true,
      io: {
        readFile: async (path) => storage[path] ?? "",
        writeFile: async (path, contents) => {
          writes[path] = contents;
        },
      },
    });

    expect(result.failed).toEqual([]);
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(writes["/tmp/a.md"]).toContain("Section: IUFS");
    expect(writes["/tmp/b.md"]).toContain("Section: IUFS");
  });
});
