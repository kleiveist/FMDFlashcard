import { describe, expect, it } from "vitest";
import { evaluateDatabaseFormula } from "./database-formulas";

const evaluate = (formula: string, fields: Record<string, unknown>) =>
  evaluateDatabaseFormula(formula, {
    getFieldValue: (key) => {
      const direct = fields[key];
      if (typeof direct !== "undefined") {
        return direct;
      }
      const lower = key.toLowerCase();
      const match = Object.entries(fields).find(([entryKey]) => entryKey.toLowerCase() === lower);
      return match?.[1] ?? null;
    },
    now: () => new Date("2026-03-21T10:00:00.000Z"),
  });

describe("database-formulas", () => {
  it("supports concat + upper", () => {
    expect(evaluate("concat(upper(section), ' / ', status)", {
      section: "iufs",
      status: "3 🟡",
    })).toBe("IUFS / 3 🟡");
  });

  it("supports if with comparator", () => {
    expect(evaluate("if(percent(score) >= 50, true, false)", {
      score: { raw: "20/25", value: 20, max: 25, ratio: 0.8 },
    })).toBe(true);
  });

  it("supports empty/lower/slice", () => {
    expect(evaluate("empty(tags)", { tags: [] })).toBe(true);
    expect(evaluate("lower(Rank)", { Rank: "SE1" })).toBe("se1");
    expect(evaluate("slice(task, 0, 4)", { task: "IU-Test" })).toBe("IU-T");
  });

  it("returns deterministic now() and null for unknown function", () => {
    expect(evaluate("now()", {})).toBe("2026-03-21T10:00:00.000Z");
    expect(evaluate("unknownFn(status)", { status: "ok" })).toBeNull();
  });
});
