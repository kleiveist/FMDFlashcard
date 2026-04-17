import { describe, expect, it } from "vitest";
import { createDefaultDatabaseBlockConfig } from "./database-block-parser";
import { buildNormalizedRecord, createSystemFieldsForRecord } from "./database-normalizers";
import { buildDatabaseStoreSnapshot } from "./database-store";
import { LEGACY_DATABASE_FORMULA_INCOMPATIBLE_MESSAGE } from "./database-formulas";

describe("database-store", () => {
  it("merges configured field definitions into attribute registry", () => {
    const record = buildNormalizedRecord({
      fileId: "demo.md",
      filePath: "/vault/demo.md",
      relativePath: "demo.md",
      frontmatter: {
        Score: "20/25",
      },
      systemFields: createSystemFieldsForRecord("demo.md", "/vault/demo.md"),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "Score",
        label: "Exam Score",
        type: "score",
        origin: "frontmatter",
      },
    ];
    config.columns = ["Exam Score", "Score"];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [record],
      config,
      searchQuery: "",
    });

    const scoreField = snapshot.attributeRegistry.find((attribute) => attribute.key === "Score");
    expect(scoreField?.label).toBe("Exam Score");
    expect(scoreField?.type).toBe("score");
    expect(scoreField?.origin).toBe("frontmatter");
  });

  it("applies configured field overrides case-insensitively", () => {
    const record = buildNormalizedRecord({
      fileId: "demo.md",
      filePath: "/vault/demo.md",
      relativePath: "demo.md",
      frontmatter: {
        section: "IUFS",
      },
      systemFields: createSystemFieldsForRecord("demo.md", "/vault/demo.md"),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "Section",
        label: "Bereich",
        type: "select",
        origin: "frontmatter",
      },
    ];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [record],
      config,
      searchQuery: "",
    });

    const sectionField = snapshot.attributeRegistry.find((attribute) => attribute.key === "Section");
    expect(sectionField?.label).toBe("Bereich");
    expect(sectionField?.type).toBe("select");
  });

  it("evaluates aggregation formula fields and exposes them to visible records", () => {
    const record = buildNormalizedRecord({
      fileId: "demo.md",
      filePath: "/vault/demo.md",
      relativePath: "demo.md",
      frontmatter: {
        status: "3 🟡",
      },
      systemFields: createSystemFieldsForRecord("demo.md", "/vault/demo.md"),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "f-status-count",
        label: "Status Count",
        type: "formula",
        origin: "formula",
        formulaDefinition: {
          version: 1,
          operation: "count",
          attributeKeys: ["status"],
          source: { type: "current-folder" },
          shortTextRule: {
            maxChars: 32,
            maxTokens: 3,
            requireSingleNumericCore: true,
          },
        },
      },
      {
        key: "f-status-group",
        type: "formula",
        origin: "formula",
        formulaDefinition: {
          version: 1,
          operation: "group_count",
          attributeKeys: ["status"],
          source: { type: "current-folder" },
          shortTextRule: {
            maxChars: 32,
            maxTokens: 3,
            requireSingleNumericCore: true,
          },
        },
      },
    ];
    config.columns = ["f-status-count", "f-status-group"];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [record],
      config,
      searchQuery: "",
    });

    expect(snapshot.visibleRecords[0]?.normalizedFields["f-status-count"]).toBe(1);
    expect(snapshot.visibleRecords[0]?.normalizedFields["f-status-group"]).toEqual([
      { value: "3 🟡", count: 1 },
    ]);

    const formulaField = snapshot.attributeRegistry.find((attribute) => attribute.key === "f-status-count");
    expect(formulaField?.origin).toBe("formula");
    expect(formulaField?.formulaDefinition?.operation).toBe("count");
  });

  it("marks legacy string formulas as incompatible and does not execute them", () => {
    const record = buildNormalizedRecord({
      fileId: "demo.md",
      filePath: "/vault/demo.md",
      relativePath: "demo.md",
      frontmatter: {
        status: "3 🟡",
      },
      systemFields: createSystemFieldsForRecord("demo.md", "/vault/demo.md"),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "legacyFormula",
        type: "formula",
        origin: "formula",
        formula: "concat(status, ' old')",
      },
    ];
    config.columns = ["legacyFormula"];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [record],
      config,
      searchQuery: "",
    });

    expect(snapshot.visibleRecords[0]?.normalizedFields.legacyFormula).toBe(
      LEGACY_DATABASE_FORMULA_INCOMPATIBLE_MESSAGE,
    );
    const legacyField = snapshot.attributeRegistry.find((attribute) => attribute.key === "legacyFormula");
    expect(legacyField?.legacyFormulaIncompatible).toBe(true);
  });

  it("evaluates frontmatter formula definitions and exposes computed values instead of object strings", () => {
    const formulaDefinition = {
      version: 1 as const,
      operation: "avg" as const,
      attributeKeys: ["percent"],
      source: { type: "current-folder" as const },
      shortTextRule: {
        maxChars: 32,
        maxTokens: 3,
        requireSingleNumericCore: true,
      },
    };

    const firstRecord = buildNormalizedRecord({
      fileId: "Course/one.md",
      filePath: "/vault/Course/one.md",
      relativePath: "Course/one.md",
      frontmatter: {
        percent: 10,
        "f-%": formulaDefinition,
      },
      systemFields: createSystemFieldsForRecord("Course/one.md", "/vault/Course/one.md"),
    });
    const secondRecord = buildNormalizedRecord({
      fileId: "Course/two.md",
      filePath: "/vault/Course/two.md",
      relativePath: "Course/two.md",
      frontmatter: {
        percent: 30,
        "f-%": formulaDefinition,
      },
      systemFields: createSystemFieldsForRecord("Course/two.md", "/vault/Course/two.md"),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.columns = ["f-%"];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [firstRecord, secondRecord],
      config,
      searchQuery: "",
    });

    const computedValues = snapshot.visibleRecords
      .map((record) => record.normalizedFields["f-%"]);
    expect(computedValues).toEqual([20, 20]);
    expect(computedValues).not.toContain("[object Object]");

    const formulaAttribute = snapshot.attributeRegistry.find((attribute) => attribute.key === "f-%");
    expect(formulaAttribute?.type).toBe("formula");
    expect(formulaAttribute?.editable).toBe(false);
  });

  it("evaluates configured formula fields against history records when source is history", () => {
    const record = buildNormalizedRecord({
      fileId: "Course/current.md",
      filePath: "/vault/Course/current.md",
      relativePath: "Course/current.md",
      frontmatter: {
        percent: 10,
      },
      systemFields: createSystemFieldsForRecord("Course/current.md", "/vault/Course/current.md"),
    });
    const historyFirst = buildNormalizedRecord({
      fileId: "/vault/.profile/exam-runs/run-a.md",
      filePath: "/vault/.profile/exam-runs/run-a.md",
      relativePath: ".profile/exam-runs/run-a.md",
      frontmatter: {
        percent: 20,
      },
      systemFields: createSystemFieldsForRecord(
        ".profile/exam-runs/run-a.md",
        "/vault/.profile/exam-runs/run-a.md",
      ),
    });
    const historySecond = buildNormalizedRecord({
      fileId: "/vault/.profile/exam-runs/run-b.md",
      filePath: "/vault/.profile/exam-runs/run-b.md",
      relativePath: ".profile/exam-runs/run-b.md",
      frontmatter: {
        percent: 40,
      },
      systemFields: createSystemFieldsForRecord(
        ".profile/exam-runs/run-b.md",
        "/vault/.profile/exam-runs/run-b.md",
      ),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "f-history-avg",
        label: "History Avg",
        type: "formula",
        origin: "formula",
        formulaDefinition: {
          version: 1,
          operation: "avg",
          attributeKeys: ["percent"],
          source: { type: "history" },
          shortTextRule: {
            maxChars: 32,
            maxTokens: 3,
            requireSingleNumericCore: true,
          },
        },
      },
    ];
    config.columns = ["f-history-avg"];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [record],
      historyRecords: [historyFirst, historySecond],
      config,
      searchQuery: "",
    });

    expect(snapshot.visibleRecords[0]?.normalizedFields["f-history-avg"]).toBe(30);
  });

  it("keeps configured unit fields as numeric unit type", () => {
    const record = buildNormalizedRecord({
      fileId: "demo.md",
      filePath: "/vault/demo.md",
      relativePath: "demo.md",
      frontmatter: {
        units: 6,
      },
      systemFields: createSystemFieldsForRecord("demo.md", "/vault/demo.md"),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "units",
        label: "Units",
        type: "unit",
        origin: "frontmatter",
      },
    ];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [record],
      config,
      searchQuery: "",
    });

    const unitsField = snapshot.attributeRegistry.find((attribute) => attribute.key === "units");
    expect(unitsField?.type).toBe("unit");
    expect(snapshot.visibleRecords[0]?.normalizedFields.units).toBe(6);
  });
});
