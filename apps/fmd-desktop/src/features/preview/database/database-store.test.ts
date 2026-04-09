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
