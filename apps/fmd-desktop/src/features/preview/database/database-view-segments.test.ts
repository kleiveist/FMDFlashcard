import { describe, expect, it } from "vitest";
import { splitDatabaseViewSegments } from "./database-view-segments";

describe("database-view-segments", () => {
  it("returns null when no database block exists", () => {
    const markdown = [
      "# Title",
      "",
      "Paragraph text.",
    ].join("\n");

    expect(splitDatabaseViewSegments(markdown)).toBeNull();
  });

  it("splits markdown around one database block", () => {
    const markdown = [
      "# Title",
      "",
      "::::",
      "title: Demo",
      "::::",
      "",
      "After block",
    ].join("\n");

    const segments = splitDatabaseViewSegments(markdown);
    expect(segments).toHaveLength(3);
    expect(segments?.[0]).toMatchObject({
      type: "markdown",
      markdown: "# Title\n\n",
    });
    expect(segments?.[1]).toMatchObject({
      type: "database-block",
      raw: "::::\ntitle: Demo\n::::",
    });
    expect(segments?.[2]).toMatchObject({
      type: "markdown",
      markdown: "\n\nAfter block",
    });
  });

  it("keeps consecutive database blocks as separate segments", () => {
    const markdown = [
      "::::",
      "title: A",
      "::::",
      "",
      "::::",
      "title: B",
      "::::",
    ].join("\n");

    const segments = splitDatabaseViewSegments(markdown);
    expect(segments?.map((segment) => segment.type)).toEqual([
      "database-block",
      "markdown",
      "database-block",
    ]);
    expect(segments?.[0]).toMatchObject({
      type: "database-block",
      raw: "::::\ntitle: A\n::::",
    });
    expect(segments?.[1]).toMatchObject({
      type: "markdown",
      markdown: "\n\n",
    });
    expect(segments?.[2]).toMatchObject({
      type: "database-block",
      raw: "::::\ntitle: B\n::::",
    });
  });
});
