import { describe, expect, it } from "vitest";
import {
  bulkUpsertDatabaseAttribute,
  coerceDatabaseRecordFieldValue,
  mapDatabaseFieldTypeToFrontmatterKind,
  upsertDatabaseRecordField,
  upsertDatabaseRecordFieldInMarkdown,
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

  it("coerces core phase-2 inline edit values", () => {
    expect(coerceDatabaseRecordFieldValue("number", "12.5")).toMatchObject({
      typedValue: 12.5,
      kind: "number",
      error: null,
    });
    expect(coerceDatabaseRecordFieldValue("boolean", "true")).toMatchObject({
      typedValue: true,
      kind: "boolean",
      error: null,
    });
    expect(coerceDatabaseRecordFieldValue("date", "2026-03-21")).toMatchObject({
      typedValue: "2026-03-21",
      kind: "text",
      error: null,
    });
    expect(coerceDatabaseRecordFieldValue("percent", "80")).toMatchObject({
      typedValue: "80%",
      kind: "text",
      error: null,
    });
    expect(coerceDatabaseRecordFieldValue("number", "not-a-number").error).toBe("Number value must be numeric.");
    expect(coerceDatabaseRecordFieldValue("boolean", "nope").error).toBe("Boolean value must be true or false.");
  });

  it("upserts record field values case-insensitively without duplicating yaml header", () => {
    const source = [
      "---",
      "section: old",
      "other: keep",
      "---",
      "Body",
    ].join("\n");

    const result = upsertDatabaseRecordFieldInMarkdown({
      markdown: source,
      key: "Section",
      type: "text",
      value: "new",
    });

    expect(result.error).toBeNull();
    expect(result.action).toBe("updated");
    expect(result.markdown).toContain("section: new");
    expect(result.markdown).toContain("other: keep");
    expect((result.markdown.match(/^---$/gm) ?? []).length).toBe(2);
  });

  it("writes single-record upserts through injected io", async () => {
    const writes: Record<string, string> = {};
    const result = await upsertDatabaseRecordField({
      path: "/tmp/record.md",
      relativePath: "record.md",
      key: "percent",
      type: "percent",
      value: "75",
      io: {
        readFile: async () => ["---", "title: Demo", "---", "Body"].join("\n"),
        writeFile: async (path, contents) => {
          writes[path] = contents;
        },
      },
    });

    expect(result.error).toBeNull();
    expect(result.action).toBe("added");
    expect(result.changed).toBe(true);
    expect(writes["/tmp/record.md"]).toMatch(/percent:\s*'?75%'?/);
    expect((writes["/tmp/record.md"].match(/^---$/gm) ?? []).length).toBe(2);
  });
});
