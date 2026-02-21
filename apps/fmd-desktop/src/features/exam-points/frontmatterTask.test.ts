import { describe, expect, it } from "vitest";
import {
  resolveExamTaskFrontmatterValue,
  upsertExamTaskFrontmatterValue,
} from "./frontmatterTask";

describe("exam points frontmatter task helpers", () => {
  it("reads Task from frontmatter", () => {
    const markdown = ["---", "Task: Exam", "---", "#exam", "1) Demo", "#examend"].join(
      "\n",
    );
    expect(resolveExamTaskFrontmatterValue(markdown)).toBe("Exam");
  });

  it("updates existing Task key", () => {
    const markdown = ["---", "Task: Exam", "Title: Demo", "---", "Body"].join("\n");
    const updated = upsertExamTaskFrontmatterValue({
      markdown,
      profileName: "TrueFalse",
    });
    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("Task: TrueFalse");
    expect(updated.markdown).toContain("Title: Demo");
    expect(updated.markdown.endsWith("Body")).toBe(true);
  });

  it("adds Task key to existing frontmatter", () => {
    const markdown = ["---", "Title: Demo", "---", "#exam"].join("\n");
    const updated = upsertExamTaskFrontmatterValue({
      markdown,
      profileName: "Exam",
    });
    expect(updated.error).toBeNull();
    expect(updated.markdown).toContain("Task: Exam");
    expect(updated.markdown).toContain("Title: Demo");
  });

  it("creates frontmatter when document has none", () => {
    const markdown = ["#exam", "1) Demo", "#examend"].join("\n");
    const updated = upsertExamTaskFrontmatterValue({
      markdown,
      profileName: "Exam",
    });
    expect(updated.error).toBeNull();
    expect(updated.markdown.startsWith("---\nTask: 'Exam'\n---\n")).toBe(true);
    expect(updated.markdown).toContain("#exam");
  });
});
