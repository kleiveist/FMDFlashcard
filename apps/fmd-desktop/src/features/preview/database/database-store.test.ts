import { describe, expect, it } from "vitest";
import { createDefaultDatabaseBlockConfig } from "./database-block-parser";
import { buildNormalizedRecord, createSystemFieldsForRecord } from "./database-normalizers";
import { buildDatabaseStoreSnapshot } from "./database-store";

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

  it("evaluates formula fields and exposes them to visible records", () => {
    const record = buildNormalizedRecord({
      fileId: "demo.md",
      filePath: "/vault/demo.md",
      relativePath: "demo.md",
      frontmatter: {
        percent: "80%",
        status: "3 🟡",
        Score: "20/25",
      },
      systemFields: createSystemFieldsForRecord("demo.md", "/vault/demo.md"),
    });

    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "progressLabel",
        label: "Progress Label",
        type: "text",
        origin: "formula",
        formula: "concat(percent, ' / ', status)",
      },
      {
        key: "isPassed",
        type: "boolean",
        origin: "formula",
        formula: "if(percent(Score) >= 50, true, false)",
      },
    ];
    config.columns = ["progressLabel", "isPassed"];

    const snapshot = buildDatabaseStoreSnapshot({
      records: [record],
      config,
      searchQuery: "",
    });

    expect(snapshot.visibleRecords[0]?.normalizedFields.progressLabel).toBe("80% / 3 🟡");
    expect(snapshot.visibleRecords[0]?.normalizedFields.isPassed).toBe(true);

    const formulaField = snapshot.attributeRegistry.find((attribute) => attribute.key === "progressLabel");
    expect(formulaField?.origin).toBe("formula");
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
