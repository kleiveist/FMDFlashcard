import { describe, expect, it } from "vitest";
import {
  evaluateDatabaseAggregationFormula,
} from "./database-formulas";
import {
  type DatabaseFormulaDefinitionV1,
  DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE,
} from "../formula/database-formula-types";
import { type DatabaseRecord } from "./database-types";

const createRecord = ({
  id,
  relativePath,
  fields,
}: {
  id: string;
  relativePath: string;
  fields: Record<string, unknown>;
}): DatabaseRecord => {
  const normalizedFields = Object.entries(fields).reduce<Record<string, string | number | boolean | string[] | null>>(
    (bucket, [key, value]) => {
      bucket[key] = value as string | number | boolean | string[] | null;
      return bucket;
    },
    {},
  );

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
    normalizedFields,
  };
};

const baseFormula = (
  overrides: Partial<DatabaseFormulaDefinitionV1>,
): DatabaseFormulaDefinitionV1 => ({
  version: 1,
  operation: "count",
  attributeKeys: ["Status"],
  source: {
    type: "current-folder",
  },
  shortTextRule: {
    ...DEFAULT_DATABASE_FORMULA_SHORT_TEXT_RULE,
  },
  ...overrides,
});

describe("database-formulas", () => {
  it("evaluates avg/sum/count/group_count on merged attribute values", () => {
    const records = [
      createRecord({ id: "1", relativePath: "a/one.md", fields: { Status: "4 🟠" } }),
      createRecord({ id: "2", relativePath: "a/two.md", fields: { Status: "2 🟢" } }),
      createRecord({ id: "3", relativePath: "a/three.md", fields: { Status: "3 🟢" } }),
      createRecord({ id: "4", relativePath: "a/four.md", fields: { Status: "4 🟠" } }),
    ];

    const avg = evaluateDatabaseAggregationFormula({
      definition: baseFormula({ operation: "avg" }),
      records,
      currentRecord: records[0]!,
    });
    const sum = evaluateDatabaseAggregationFormula({
      definition: baseFormula({ operation: "sum" }),
      records,
      currentRecord: records[0]!,
    });
    const count = evaluateDatabaseAggregationFormula({
      definition: baseFormula({ operation: "count" }),
      records,
      currentRecord: records[0]!,
    });
    const grouped = evaluateDatabaseAggregationFormula({
      definition: baseFormula({ operation: "group_count" }),
      records,
      currentRecord: records[0]!,
    });

    expect(avg).toBe(3.25);
    expect(sum).toBe(13);
    expect(count).toBe(4);
    expect(grouped).toEqual([
      { value: "4 🟠", count: 2 },
      { value: "2 🟢", count: 1 },
      { value: "3 🟢", count: 1 },
    ]);
  });

  it("filters by source scope (current-folder, explicit-folder, multi-folder)", () => {
    const records = [
      createRecord({ id: "1", relativePath: "alpha/one.md", fields: { Status: 1 } }),
      createRecord({ id: "2", relativePath: "alpha/two.md", fields: { Status: 2 } }),
      createRecord({ id: "3", relativePath: "beta/one.md", fields: { Status: 3 } }),
      createRecord({ id: "4", relativePath: "gamma/one.md", fields: { Status: 4 } }),
    ];

    const currentFolderCount = evaluateDatabaseAggregationFormula({
      definition: baseFormula({ operation: "count", source: { type: "current-folder" } }),
      records,
      currentRecord: records[0]!,
    });

    const explicitFolderSum = evaluateDatabaseAggregationFormula({
      definition: baseFormula({ operation: "sum", source: { type: "explicit-folder", path: "beta" } }),
      records,
      currentRecord: records[0]!,
    });

    const multiFolderCount = evaluateDatabaseAggregationFormula({
      definition: baseFormula({
        operation: "count",
        source: { type: "multi-folder", paths: ["alpha", "gamma"] },
      }),
      records,
      currentRecord: records[2]!,
    });

    expect(currentFolderCount).toBe(2);
    expect(explicitFolderSum).toBe(3);
    expect(multiFolderCount).toBe(3);
  });

  it("rejects long/unstructured text for math but keeps count/group_count", () => {
    const records = [
      createRecord({
        id: "1",
        relativePath: "alpha/one.md",
        fields: {
          Notes: "Das ist ein langer Fliesstext ohne stabilen Zahlenkern fuer eine Aggregation.",
        },
      }),
      createRecord({
        id: "2",
        relativePath: "alpha/two.md",
        fields: {
          Notes: "Kurz 2",
        },
      }),
    ];

    const avg = evaluateDatabaseAggregationFormula({
      definition: {
        ...baseFormula({
          operation: "avg",
          attributeKeys: ["Notes"],
        }),
      },
      records,
      currentRecord: records[0]!,
    });

    const count = evaluateDatabaseAggregationFormula({
      definition: {
        ...baseFormula({
          operation: "count",
          attributeKeys: ["Notes"],
        }),
      },
      records,
      currentRecord: records[0]!,
    });

    const grouped = evaluateDatabaseAggregationFormula({
      definition: {
        ...baseFormula({
          operation: "group_count",
          attributeKeys: ["Notes"],
        }),
      },
      records,
      currentRecord: records[0]!,
    });

    expect(avg).toBe(2);
    expect(count).toBe(2);
    expect(grouped).toEqual([
      { value: "Das ist ein langer Fliesstext ohne stabilen Zahlenkern fuer eine Aggregation.", count: 1 },
      { value: "Kurz 2", count: 1 },
    ]);
  });
});
