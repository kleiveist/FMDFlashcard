import { describe, expect, it } from "vitest";
import { parseFrontmatterDocument } from "../preview/frontmatter";
import { upsertExamResultStatsFrontmatter } from "./frontmatterStats";

const collectKeys = (markdown: string) =>
  parseFrontmatterDocument(markdown).properties.map((property) => property.key);

describe("upsertExamResultStatsFrontmatter", () => {
  it("creates frontmatter when none exists", () => {
    const markdown = ["#exam", "1) Demo", "#endexam"].join("\n");
    const result = upsertExamResultStatsFrontmatter({
      markdown,
      score: "7/10",
      percent: "70%",
      status: "4 🟠",
    });

    expect(result.error).toBeNull();
    expect(result.markdown).toContain("Score: '7/10'");
    expect(result.markdown).toContain("percent: '70'");
    expect(result.markdown).toContain("status: '4'");
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
      "#endexam",
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
    expect(parsed.properties.find((property) => property.key === "percent")?.value).toBe("90");
    expect(parsed.properties.find((property) => property.key === "status")?.value).toBe("1");
  });

  it("keeps exactly one set of stats keys across repeated writes", () => {
    const initial = ["---", "Task: Exam", "---", "#exam", "1) Demo", "#endexam"].join("\n");
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

  it("does not add corrected result fields when none are provided", () => {
    const markdown = ["#exam", "1) Demo", "#endexam"].join("\n");
    const result = upsertExamResultStatsFrontmatter({
      markdown,
      score: "7/10",
      percent: "70%",
      status: "4 🟠",
    });

    expect(result.error).toBeNull();
    expect(result.markdown).not.toContain("Corrected score:");
    expect(result.markdown).not.toContain("Corrected percent:");
    expect(result.markdown).not.toContain("Corrected status:");
  });

  it("preserves existing corrected fields when a later write omits them", () => {
    const initialMarkdown = [
      "---",
      "Task: Exam",
      "Corrected score: '8/10'",
      "Corrected percent: '80%'",
      "Corrected status: '2 🟢'",
      "---",
      "#exam",
      "1) Demo",
      "#endexam",
    ].join("\n");
    const second = upsertExamResultStatsFrontmatter({
      markdown: initialMarkdown,
      score: "7/10",
      percent: "70%",
      status: "3 🟡",
    });

    expect(second.error).toBeNull();
    expect(second.markdown).toContain("Corrected score: '8/10'");
    expect(second.markdown).toContain("Corrected percent: '80%'");
    expect(second.markdown).toContain("Corrected status: '2 🟢'");
  });
});
