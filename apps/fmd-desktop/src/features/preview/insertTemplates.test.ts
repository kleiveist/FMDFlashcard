import { describe, expect, it } from "vitest";
import {
  ADVANCED_INSERT_TEMPLATE_CATALOG,
  getAdvancedInsertTemplateSections,
} from "./insertTemplates";

describe("insertTemplates", () => {
  it("contains Advanced templates for all required modes", () => {
    const modes = new Set(ADVANCED_INSERT_TEMPLATE_CATALOG.map((template) => template.mode));
    const requiredModes = ["cd", "cl", "cld", "e", "ea", "m1", "m2", "qa", "tf"] as const;

    requiredModes.forEach((mode) => {
      expect(modes.has(mode)).toBe(true);
    });
  });

  it("filters nested card container templates inside card context", () => {
    const sections = getAdvancedInsertTemplateSections({
      insideCard: true,
      insideExam: false,
    });
    const visibleModes = new Set(
      sections.flatMap((section) => section.items.map((item) => item.mode)),
    );

    ["qa", "tf", "m1", "m2", "cl", "cd", "cld", "e"].forEach((mode) => {
      expect(visibleModes.has(mode as (typeof ADVANCED_INSERT_TEMPLATE_CATALOG)[number]["mode"])).toBe(
        false,
      );
    });
    expect(visibleModes.has("ea")).toBe(true);
    expect(visibleModes.has("code-block")).toBe(true);
    expect(visibleModes.has("formula-block")).toBe(true);
  });

  it("prioritizes the Exam group in exam context", () => {
    const sections = getAdvancedInsertTemplateSections({
      insideCard: false,
      insideExam: true,
    });

    expect(sections[0]?.id).toBe("exam");
    const examModes = sections[0]?.items.map((item) => item.mode) ?? [];
    expect(examModes).toContain("e");
    expect(examModes).toContain("ea");
  });
});
