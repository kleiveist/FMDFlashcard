import { describe, expect, it } from "vitest";
import { normalizeDatabaseFormulaDefinitionV1 } from "./database-formula-types";

describe("database-formula-types", () => {
  it("accepts history as a formula source type", () => {
    const parsed = normalizeDatabaseFormulaDefinitionV1({
      version: 1,
      operation: "count",
      attributeKeys: ["status"],
      source: {
        type: "history",
      },
      shortTextRule: {
        maxChars: 32,
        maxTokens: 3,
        requireSingleNumericCore: true,
      },
    });

    expect(parsed).toEqual({
      version: 1,
      operation: "count",
      attributeKeys: ["status"],
      source: {
        type: "history",
      },
      shortTextRule: {
        maxChars: 32,
        maxTokens: 3,
        requireSingleNumericCore: true,
      },
    });
  });

  it("normalizes legacy history-folder formula source type to history", () => {
    const parsed = normalizeDatabaseFormulaDefinitionV1({
      version: 1,
      operation: "sum",
      attributeKeys: ["score"],
      source: {
        type: "history-folder",
      },
      shortTextRule: {
        maxChars: 32,
        maxTokens: 3,
        requireSingleNumericCore: true,
      },
    });

    expect(parsed?.source.type).toBe("history");
  });
});
