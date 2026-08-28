/**
 * @file frontend/src/features/exam/useExamFiles.test.ts
 *
 * Zweck:
 * - Tests fuer Exam-Datei-Klassifizierung.
 */

import { describe, expect, it } from "vitest";
import { buildExamFileErrorEntry, classifyExamMarkdown } from "./useExamFiles";

describe("classifyExamMarkdown", () => {
  it("classifies empty markdown as empty", () => {
    const result = classifyExamMarkdown("\n   \n");

    expect(result.status).toBe("empty");
    expect(result.taskCount).toBe(0);
    expect(result.hasExamBlock).toBe(false);
  });

  it("classifies valid exam files", () => {
    const result = classifyExamMarkdown(`#exam\n1) Task A\n2) Task B\n#endexam`);

    expect(result.status).toBe("valid");
    expect(result.taskCount).toBe(2);
    expect(result.hasExamBlock).toBe(true);
  });

  it("classifies files without exam tasks", () => {
    const result = classifyExamMarkdown(`#exam\nNur Text\n#endexam`);

    expect(result.status).toBe("no-tasks");
    expect(result.taskCount).toBe(0);
    expect(result.hasExamBlock).toBe(true);
  });

  it("classifies markdown without exam wrapper as no-tasks", () => {
    const result = classifyExamMarkdown(`#card\nQ\nAnswer: A\n#endcard`);

    expect(result.status).toBe("no-tasks");
    expect(result.taskCount).toBe(0);
    expect(result.hasExamBlock).toBe(false);
  });
});

describe("buildExamFileErrorEntry", () => {
  it("builds an error status entry with reason", () => {
    const entry = buildExamFileErrorEntry(
      {
        path: "/vault/exam.md",
        relative_path: "folder/exam.md",
      },
      new Error("Read failed"),
    );

    expect(entry.status).toBe("error");
    expect(entry.taskCount).toBe(0);
    expect(entry.error).toContain("Read failed");
  });
});
