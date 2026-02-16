import { describe, expect, it } from "vitest";
import {
  addFrontmatterProperty,
  composeMarkdownWithBody,
  normalizeWikilinkValue,
  parseFrontmatterDocument,
  reorderFrontmatterProperties,
  updateFrontmatterProperty,
} from "./frontmatter";

describe("parseFrontmatterDocument", () => {
  it("parses supported property types and keeps body separate", () => {
    const source = [
      "---",
      "title: Example",
      "count: 3",
      "published: true",
      "tags:",
      "  - alpha",
      "  - beta",
      "ref: [[Folder/Doc]]",
      "cover: [[images/cover.png]]",
      "---",
      "# Heading",
      "Body",
    ].join("\n");

    const parsed = parseFrontmatterDocument(source);

    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.error).toBeNull();
    expect(parsed.body).toBe("# Heading\nBody");
    expect(parsed.properties).toEqual([
      { key: "title", kind: "text", value: "Example", icon: "text" },
      { key: "count", kind: "number", value: 3, icon: "number" },
      { key: "published", kind: "boolean", value: true, icon: "boolean" },
      { key: "tags", kind: "tags", value: ["alpha", "beta"], icon: "tags" },
      { key: "ref", kind: "link", value: "[[Folder/Doc]]", icon: "link" },
      {
        key: "cover",
        kind: "cover",
        value: "[[images/cover.png]]",
        icon: "cover",
      },
    ]);
  });

  it("reports duplicate keys as parse error", () => {
    const source = ["---", "Title: A", "Title: B", "---", "Body"].join("\n");

    const parsed = parseFrontmatterDocument(source);

    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.error).toContain("Duplicate YAML key");
  });

  it("accepts loose list continuation without indentation", () => {
    const source = [
      "---",
      "Cover: '[[IDBS01KS-01-01.png]]'",
      "Section: IUFS",
      "Rank: SE1",
      "Projekt: IDBS01",
      "Task: Exam",
      "Ergebnis: '0 | Nicht begonnen'",
      "Prozent: '0% | 0'",
      "MuiChoi: null",
      "TransA3: null",
      "tags:",
      "- IDBS01KS-01",
      "- IUFS",
      "- SE1",
      "- IDBS01",
      "- Exam",
      "link1: '[[IDBS01KS-01]]'",
      "---",
      "Body",
    ].join("\n");

    const parsed = parseFrontmatterDocument(source);

    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.error).toBeNull();
    expect(parsed.properties.find((property) => property.key === "tags")?.value).toEqual([
      "IDBS01KS-01",
      "IUFS",
      "SE1",
      "IDBS01",
      "Exam",
    ]);
    expect(parsed.properties.find((property) => property.key === "Cover")?.kind).toBe(
      "cover",
    );
    expect(parsed.properties.find((property) => property.key === "link1")?.kind).toBe(
      "link",
    );
  });
});

describe("composeMarkdownWithBody", () => {
  it("replaces only the markdown body while preserving frontmatter prefix", () => {
    const source = ["---", "title: Demo", "---", "Old body"].join("\n");

    const next = composeMarkdownWithBody(source, "New body");

    expect(next).toBe(["---", "title: Demo", "---", "New body"].join("\n"));
  });
});

describe("updateFrontmatterProperty", () => {
  it("updates one key and keeps body byte-identical", () => {
    const source = [
      "---",
      "title: Demo",
      "meta:",
      "  nested: true",
      "tags:",
      "  - alpha",
      "---",
      "Line A",
      "Line B",
    ].join("\n");
    const originalParsed = parseFrontmatterDocument(source);

    const updated = updateFrontmatterProperty({
      markdown: source,
      key: "title",
      kind: "text",
      value: "Changed",
    });

    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("title: Changed");
    expect(updated.markdown).toContain("meta:\n  nested: true");
    expect(updated.markdown.slice(-originalParsed.body.length)).toBe(
      originalParsed.body,
    );
  });

  it("serializes tags as YAML list and clears empty values to null", () => {
    const source = ["---", "tags: null", "title: Demo", "---", "Body"].join("\n");

    const updatedTags = updateFrontmatterProperty({
      markdown: source,
      key: "tags",
      kind: "tags",
      value: ["one", "two", "one"],
    });
    const clearedTitle = updateFrontmatterProperty({
      markdown: updatedTags.markdown,
      key: "title",
      kind: "text",
      value: "",
    });

    expect(updatedTags.error).toBeNull();
    expect(updatedTags.markdown).toContain("tags:\n  - one\n  - two");
    expect(clearedTitle.error).toBeNull();
    expect(clearedTitle.markdown).toContain("title: null");
  });
});

describe("addFrontmatterProperty", () => {
  it("appends a new key while keeping body unchanged", () => {
    const source = ["---", "title: Demo", "---", "Body"].join("\n");

    const updated = addFrontmatterProperty({
      markdown: source,
      key: "Section",
      value: "IUFS",
    });

    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("title: Demo");
    expect(updated.markdown).toContain("Section: IUFS");
    expect(updated.markdown).toContain("---\nBody");
  });

  it("rejects duplicate keys", () => {
    const source = ["---", "title: Demo", "---", "Body"].join("\n");

    const updated = addFrontmatterProperty({
      markdown: source,
      key: "title",
      value: "Second",
    });

    expect(updated.error).toContain("already exists");
  });
});

describe("reorderFrontmatterProperties", () => {
  it("moves a property before another key and keeps body intact", () => {
    const source = [
      "---",
      "title: Demo",
      "rank: SE1",
      "section: IUFS",
      "---",
      "Body line",
    ].join("\n");

    const updated = reorderFrontmatterProperties({
      markdown: source,
      fromKey: "section",
      toKey: "title",
      position: "before",
    });

    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("section: IUFS\ntitle: Demo\nrank: SE1");
    expect(updated.markdown).toContain("---\nBody line");
  });

  it("returns an error when source key does not exist", () => {
    const source = ["---", "title: Demo", "---", "Body"].join("\n");

    const updated = reorderFrontmatterProperties({
      markdown: source,
      fromKey: "missing",
      toKey: "title",
      position: "before",
    });

    expect(updated.error).toContain("was not found");
  });
});

describe("normalizeWikilinkValue", () => {
  it("normalizes plain input into wikilink format", () => {
    expect(normalizeWikilinkValue("Folder/Note")).toBe("[[Folder/Note]]");
    expect(normalizeWikilinkValue("[[Already/Linked]]")).toBe(
      "[[Already/Linked]]",
    );
  });
});
