import { describe, expect, it } from "vitest";
import { parseFrontmatterDocument } from "../preview/frontmatter";
import { upsertExamResultStatsFrontmatter } from "./frontmatterStats";

const collectKeys = (markdown: string) =>
  parseFrontmatterDocument(markdown).properties.map((property) => property.key);

describe("upsertExamResultStatsFrontmatter", () => {
  it("creates frontmatter when none exists", () => {
    const markdown = ["#exam", "1) Demo", "#examend"].join("\n");
    const result = upsertExamResultStatsFrontmatter({
      markdown,
      score: "7/10",
      percent: "70%",
      status: "4 🟠",
    });

    expect(result.error).toBeNull();
    expect(result.markdown).toContain("Score: '7/10'");
    expect(result.markdown).toContain("percent: '70%'");
    expect(result.markdown).toContain("status: '4 🟠'");
    expect(result.markdown).toContain("#exam");
  });

  it("overwrites existing keys case-insensitively without duplicates", () => {
    const markdown = [
      "---",
      "score: '1/10'",
      "Percent: '10%'",
      "STATUS: '5 🔴'",
      "Task: Exam",
      "---",
      "#exam",
      "1) Demo",
      "#examend",
    ].join("\n");

    const result = upsertExamResultStatsFrontmatter({
      markdown,
      score: "9/10",
      percent: "90%",
      status: "1 🔵",
    });

    expect(result.error).toBeNull();
    const parsed = parseFrontmatterDocument(result.markdown);
    expect(parsed.error).toBeNull();
    expect(collectKeys(result.markdown)).toEqual(["Task", "Score", "percent", "status"]);
    expect(parsed.properties.find((property) => property.key === "Score")?.value).toBe("9/10");
    expect(parsed.properties.find((property) => property.key === "percent")?.value).toBe("90%");
    expect(parsed.properties.find((property) => property.key === "status")?.value).toBe("1 🔵");
  });

  it("keeps exactly one set of stats keys across repeated writes", () => {
    const initial = ["---", "Task: Exam", "---", "#exam", "1) Demo", "#examend"].join("\n");
    const first = upsertExamResultStatsFrontmatter({
      markdown: initial,
      score: "3/10",
      percent: "30%",
      status: "5 🔴",
    });
    const second = upsertExamResultStatsFrontmatter({
      markdown: first.markdown,
      score: "8/10",
      percent: "80%",
      status: "2 🟢",
    });

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const keys = collectKeys(second.markdown);
    expect(keys.filter((key) => key.toLowerCase() === "score")).toHaveLength(1);
    expect(keys.filter((key) => key.toLowerCase() === "percent")).toHaveLength(1);
    expect(keys.filter((key) => key.toLowerCase() === "status")).toHaveLength(1);
  });
});

