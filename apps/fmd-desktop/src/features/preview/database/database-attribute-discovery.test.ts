import { describe, expect, it } from "vitest";
import {
  buildVaultAttributeIndexFromMarkdownDocuments,
  createEmptyVaultAttributeIndex,
} from "./database-attribute-discovery";

describe("database-attribute-discovery", () => {
  it("extracts vault attributes, dedupes case-insensitively, and keeps counts", () => {
    const index = buildVaultAttributeIndexFromMarkdownDocuments([
      [
        "---",
        "Status: open",
        "units: 2",
        "---",
        "# A",
      ].join("\n"),
      [
        "---",
        "status: done",
        "priority: high",
        "---",
        "# B",
      ].join("\n"),
      "# no frontmatter",
    ]);

    expect(index.suggestions[0]?.normalizedKey).toBe("status");
    expect(index.suggestions[0]?.key).toBe("status");
    expect(index.suggestions[0]?.count).toBe(2);

    expect(index.byNormalizedKey.units?.key).toBe("units");
    expect(index.byNormalizedKey.units?.count).toBe(1);
    expect(index.byNormalizedKey.priority?.key).toBe("priority");
    expect(index.byNormalizedKey.priority?.count).toBe(1);
  });

  it("keeps original casing when there is no case conflict", () => {
    const index = buildVaultAttributeIndexFromMarkdownDocuments([
      [
        "---",
        "Priority: 1",
        "---",
        "# A",
      ].join("\n"),
    ]);

    expect(index.suggestions).toEqual([
      {
        key: "Priority",
        normalizedKey: "priority",
        count: 1,
      },
    ]);
  });

  it("returns an empty index when no frontmatter attributes exist", () => {
    const fromEmptyDocs = buildVaultAttributeIndexFromMarkdownDocuments([]);
    const fromPlainMarkdown = buildVaultAttributeIndexFromMarkdownDocuments([
      "# plain markdown",
      "## still no frontmatter",
    ]);

    expect(fromEmptyDocs).toEqual(createEmptyVaultAttributeIndex());
    expect(fromPlainMarkdown).toEqual(createEmptyVaultAttributeIndex());
  });
});
