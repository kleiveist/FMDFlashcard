import { describe, expect, it } from "vitest";
import {
  buildNormalizedRecord,
  createSystemFieldsForRecord,
  inferFieldType,
  normalizeFieldValueByType,
  parsePercentValue,
  parseScoreValue,
  parseStatusValue,
} from "./database-normalizers";

describe("database-normalizers", () => {
  it("parses score values", () => {
    expect(parseScoreValue("20/25")).toEqual({
      raw: "20/25",
      value: 20,
      max: 25,
      ratio: 0.8,
    });
    expect(parseScoreValue("20 / 0")).toBeNull();
    expect(parseScoreValue("abc")).toBeNull();
  });

  it("parses percent values", () => {
    expect(parsePercentValue("80%")).toEqual({
      raw: "80%",
      value: 80,
    });
    expect(parsePercentValue("-5.5%")).toEqual({
      raw: "-5.5%",
      value: -5.5,
    });
    expect(parsePercentValue("80")).toBeNull();
  });

  it("normalizes status values with rank + emoji", () => {
    expect(parseStatusValue("3 🟡")).toEqual({
      raw: "3 🟡",
      rank: 3,
      label: "🟡",
      emoji: "🟡",
    });
    expect(parseStatusValue("Open")).toEqual({
      raw: "Open",
      label: "Open",
    });
  });

  it("infers key field types", () => {
    expect(inferFieldType("Score", "20/25")).toBe("score");
    expect(inferFieldType("percent", "80%")).toBe("percent");
    expect(inferFieldType("status", "3 🟡")).toBe("status");
    expect(inferFieldType("tags", ["A", "B"])).toBe("tags");
    expect(inferFieldType("date", "2026-03-21")).toBe("date");
    expect(inferFieldType("start", "14:30")).toBe("time");
    expect(inferFieldType("start", "2026-04-03T09:15")).toBe("datetime");
  });

  it("normalizes time values", () => {
    expect(normalizeFieldValueByType("time", "14:30")).toBe("14:30");
  });

  it("builds normalized records and protects against case-insensitive duplicate keys", () => {
    const systemFields = createSystemFieldsForRecord("path/Exam.md", "/vault/path/Exam.md");
    const record = buildNormalizedRecord({
      fileId: "path/Exam.md",
      filePath: "/vault/path/Exam.md",
      relativePath: "path/Exam.md",
      systemFields,
      frontmatter: {
        Score: "20/25",
        percent: "80%",
        STATUS: "3 🟡",
        dateiname: "should-not-overwrite-system",
      },
    });

    expect(record.normalizedFields.Score).toMatchObject({ value: 20, max: 25, ratio: 0.8 });
    expect(record.normalizedFields.percent).toMatchObject({ value: 80 });
    expect(record.normalizedFields.STATUS).toMatchObject({ rank: 3 });
    expect(record.normalizedFields.Dateiname).toBe("Exam");
    expect(record.normalizedFields.dateiname).toBeUndefined();
  });
});
