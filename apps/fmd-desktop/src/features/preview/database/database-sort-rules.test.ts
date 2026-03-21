import { describe, expect, it } from "vitest";
import { toggleDatabaseSortRuleByField } from "./database-sort-rules";
import { type DatabaseSortRule } from "./database-types";

describe("database-sort-rules", () => {
  it("cycles asc -> desc -> remove for same field", () => {
    const step1 = toggleDatabaseSortRuleByField([], "Rank");
    expect(step1).toHaveLength(1);
    expect(step1[0]?.field).toBe("Rank");
    expect(step1[0]?.dir).toBe("asc");

    const step2 = toggleDatabaseSortRuleByField(step1, "Rank");
    expect(step2).toHaveLength(1);
    expect(step2[0]?.field).toBe("Rank");
    expect(step2[0]?.dir).toBe("desc");

    const step3 = toggleDatabaseSortRuleByField(step2, "Rank");
    expect(step3).toEqual([]);
  });

  it("always promotes touched sort rule to highest priority", () => {
    const initial: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "Section",
        dir: "asc",
      },
      {
        id: "sort-2",
        field: "Score",
        dir: "asc",
      },
    ];

    const afterAddingRank = toggleDatabaseSortRuleByField(initial, "Rank");
    expect(afterAddingRank.map((rule) => rule.field)).toEqual(["Rank", "Section", "Score"]);
    expect(afterAddingRank[0]?.dir).toBe("asc");

    const afterTogglingSection = toggleDatabaseSortRuleByField(afterAddingRank, "Section");
    expect(afterTogglingSection.map((rule) => rule.field)).toEqual(["Section", "Rank", "Score"]);
    expect(afterTogglingSection[0]?.dir).toBe("desc");
  });

  it("matches sort fields case-insensitively", () => {
    const initial: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "Rank",
        dir: "asc",
      },
    ];

    const toggled = toggleDatabaseSortRuleByField(initial, "rank");
    expect(toggled).toHaveLength(1);
    expect(toggled[0]?.field).toBe("rank");
    expect(toggled[0]?.dir).toBe("desc");

    const removed = toggleDatabaseSortRuleByField(toggled, "RANK");
    expect(removed).toEqual([]);
  });
});
