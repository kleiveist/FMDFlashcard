import { describe, expect, it } from "vitest";
import {
  addFrontmatterProperty,
  buildFrontmatterKeySuggestionList,
  buildFrontmatterSuggestionIndex,
  buildFrontmatterValueSuggestionMap,
  buildFrontmatterValueSuggestionMapFromIndex,
  collectFrontmatterValueSuggestions,
  composeMarkdownWithBody,
  extractWikilinkTarget,
  isLinkPropertyKey,
  normalizeWikilinkValue,
  parseFrontmatterDocument,
  parseFrontmatterLinks,
  removeFrontmatterProperty,
  reorderFrontmatterProperties,
  updateFrontmatterLinks,
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

  it("accepts loose wikilink lines and keeps normal properties visible", () => {
    const source = [
      "---",
      "title: Demo",
      "[[IDBS01-TestL6]]",
      "rank: SE1",
      "---",
      "Body",
    ].join("\n");

    const parsed = parseFrontmatterDocument(source);

    expect(parsed.error).toBeNull();
    expect(parsed.properties.map((property) => property.key)).toEqual([
      "title",
      "rank",
    ]);
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

describe("removeFrontmatterProperty", () => {
  it("removes a key while keeping body unchanged", () => {
    const source = [
      "---",
      "title: Demo",
      "rank: SE1",
      "section: IUFS",
      "---",
      "Body line",
    ].join("\n");

    const updated = removeFrontmatterProperty({
      markdown: source,
      key: "rank",
    });

    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("title: Demo");
    expect(updated.markdown).toContain("section: IUFS");
    expect(updated.markdown).not.toContain("rank: SE1");
    expect(updated.markdown).toContain("---\nBody line");
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

describe("wikilink helpers", () => {
  it("extracts wikilink targets", () => {
    expect(extractWikilinkTarget("[[Folder/Note|Alias]]")).toBe("Folder/Note");
    expect(extractWikilinkTarget("plain")).toBeNull();
  });

  it("recognizes link property keys", () => {
    expect(isLinkPropertyKey("link1")).toBe(true);
    expect(isLinkPropertyKey("links")).toBe(true);
    expect(isLinkPropertyKey("Section")).toBe(false);
  });
});

describe("parseFrontmatterLinks", () => {
  it("collects links from link keys and loose wikilink lines", () => {
    const source = [
      "---",
      "link1: [[IDBS01-TestL5]]",
      "[[IDBS01-TestL6]]",
      "link2: [[IDBS01-TestL7]]",
      "---",
      "Body",
    ].join("\n");

    const parsed = parseFrontmatterLinks(source);

    expect(parsed.error).toBeNull();
    expect(parsed.layout).toBe("link-keys");
    expect(parsed.links).toEqual([
      "[[IDBS01-TestL5]]",
      "[[IDBS01-TestL6]]",
      "[[IDBS01-TestL7]]",
    ]);
  });
});

describe("updateFrontmatterLinks", () => {
  it("keeps link key format when linkN keys already exist", () => {
    const source = [
      "---",
      "title: Demo",
      "link1: [[IDBS01-TestL5]]",
      "link2: [[IDBS01-TestL6]]",
      "rank: SE1",
      "---",
      "Body",
    ].join("\n");

    const updated = updateFrontmatterLinks({
      markdown: source,
      links: ["[[IDBS01-TestL7]]", "IDBS01-TestL8", "[[IDBS01-TestL7]]"],
    });

    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("link1: [[IDBS01-TestL7]]");
    expect(updated.markdown).toContain("link2: [[IDBS01-TestL8]]");
    expect(updated.markdown).not.toContain("links:");
    expect(updated.markdown).toContain("---\nBody");
  });

  it("keeps links array format when links array is already used", () => {
    const source = [
      "---",
      "title: Demo",
      "links:",
      "  - [[IDBS01-TestL1]]",
      "  - [[IDBS01-TestL2]]",
      "---",
      "Body",
    ].join("\n");

    const updated = updateFrontmatterLinks({
      markdown: source,
      links: ["IDBS01-TestL3"],
    });

    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("links:\n  - [[IDBS01-TestL3]]");
    expect(updated.markdown).not.toContain("link1:");
  });

  it("removes all link fields when the links list is empty", () => {
    const source = [
      "---",
      "title: Demo",
      "link1: [[IDBS01-TestL1]]",
      "link2: [[IDBS01-TestL2]]",
      "rank: SE1",
      "---",
      "Body",
    ].join("\n");

    const updated = updateFrontmatterLinks({
      markdown: source,
      links: [],
    });

    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("title: Demo");
    expect(updated.markdown).toContain("rank: SE1");
    expect(updated.markdown).not.toContain("link1:");
    expect(updated.markdown).not.toContain("link2:");
    expect(updated.markdown).toContain("---\nBody");
  });
});

describe("frontmatter value suggestions", () => {
  it("collects values by exact key without mixing", () => {
    const suggestions = collectFrontmatterValueSuggestions([
      { key: "Section", kind: "text", value: "IUFS", icon: "text" },
      { key: "Section", kind: "text", value: "DBA", icon: "text" },
      { key: "Rank", kind: "text", value: "SE1", icon: "text" },
      { key: "Rank", kind: "number", value: 2, icon: "number" },
      { key: "tags", kind: "tags", value: ["a", "b"], icon: "tags" },
    ]);

    expect(suggestions.Section).toEqual(["DBA", "IUFS"]);
    expect(suggestions.Rank).toEqual(["2", "SE1"]);
    expect(suggestions.tags).toBeUndefined();
  });

  it("builds a key-based value map from markdown documents", () => {
    const suggestions = buildFrontmatterValueSuggestionMap([
      ["---", "Section: IUFS", "Rank: 2", "---", "Body"].join("\n"),
      ["---", "Section: DBA", "Rank: 10", "---", "Body"].join("\n"),
      "No frontmatter",
    ]);

    expect(suggestions.Section).toEqual(["DBA", "IUFS"]);
    expect(suggestions.Rank).toEqual(["2", "10"]);
  });
});

describe("frontmatter suggestion index", () => {
  it("builds key and value counts across markdown documents", () => {
    const index = buildFrontmatterSuggestionIndex([
      ["---", "Section: IUFS", "Rank: SE1", "tags:", "  - alpha", "---", "Body"].join(
        "\n",
      ),
      ["---", "Section: IUFS", "Rank: SE2", "---", "Body"].join("\n"),
      ["---", "Rank: SE2", "---", "Body"].join("\n"),
    ]);

    expect(index.keyIndex.Section).toBe(2);
    expect(index.keyIndex.Rank).toBe(3);
    expect(index.keyIndex.tags).toBe(1);
    expect(index.valueIndex.Section?.IUFS).toBe(2);
    expect(index.valueIndex.Rank?.SE2).toBe(2);
  });

  it("sorts key suggestions by frequency desc and then alphabetically", () => {
    const keys = buildFrontmatterKeySuggestionList([
      ["---", "Rank: SE1", "Section: IUFS", "---", "Body"].join("\n"),
      ["---", "Rank: SE2", "---", "Body"].join("\n"),
      ["---", "Cover: [[img.png]]", "---", "Body"].join("\n"),
    ]);

    expect(keys).toEqual(["Rank", "Cover", "Section"]);
  });

  it("builds value map from index with numeric sort and count ordering", () => {
    const map = buildFrontmatterValueSuggestionMapFromIndex({
      Rank: { "10": 1, "2": 4 },
      Section: { IUFS: 3, DBA: 1, ACA: 1 },
    });

    expect(map.Rank).toEqual(["2", "10"]);
    expect(map.Section).toEqual(["IUFS", "ACA", "DBA"]);
  });
});
