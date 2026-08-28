import { describe, expect, it } from "vitest";
import { resolveFormulaSourceRecords } from "./formula-source-resolver";
import { type DatabaseRecord } from "../database/database-types";

const createRecord = ({
  id,
  relativePath,
  fields,
}: {
  id: string;
  relativePath: string;
  fields: Record<string, unknown>;
}): DatabaseRecord => {
  const slashIndex = relativePath.lastIndexOf("/");
  const folder = slashIndex >= 0 ? relativePath.slice(0, slashIndex) : "";
  const fileName = slashIndex >= 0 ? relativePath.slice(slashIndex + 1) : relativePath;
  return {
    fileId: id,
    filePath: `/vault/${relativePath}`,
    relativePath,
    fileName,
    folder,
    extension: "md",
    frontmatter: { ...fields },
    systemFields: {
      Dateiname: fileName.replace(/\.md$/i, ""),
      Dateiendung: "md",
      Dateipfad: relativePath,
      Ordner: folder,
    },
    normalizedFields: fields as DatabaseRecord["normalizedFields"],
  };
};

describe("formula-source-resolver", () => {
  it("resolves history source from history records only", () => {
    const records = [
      createRecord({ id: "1", relativePath: "Course/one.md", fields: { score: 10 } }),
      createRecord({ id: "2", relativePath: "Course/two.md", fields: { score: 20 } }),
    ];
    const historyRecords = [
      createRecord({ id: "h1", relativePath: ".profile/exam-runs/run-a.md", fields: { score: 30 } }),
    ];

    const scoped = resolveFormulaSourceRecords({
      source: { type: "history" },
      records,
      currentRecord: records[0]!,
      historyRecords,
    });

    expect(scoped.map((record) => record.relativePath)).toEqual([".profile/exam-runs/run-a.md"]);
  });

  it("keeps multi-folder source behavior unchanged", () => {
    const records = [
      createRecord({ id: "1", relativePath: "A/one.md", fields: { score: 1 } }),
      createRecord({ id: "2", relativePath: "B/two.md", fields: { score: 2 } }),
      createRecord({ id: "3", relativePath: "B/Sub/three.md", fields: { score: 3 } }),
    ];

    const scoped = resolveFormulaSourceRecords({
      source: { type: "multi-folder", paths: ["A", "B/Sub"] },
      records,
      currentRecord: records[0]!,
      historyRecords: [],
    });

    expect(scoped.map((record) => record.relativePath)).toEqual(["A/one.md", "B/Sub/three.md"]);
  });
});
