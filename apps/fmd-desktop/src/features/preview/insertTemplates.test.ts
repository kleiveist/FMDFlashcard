import { describe, expect, it } from "vitest";
import {
  ADVANCED_INSERT_TEMPLATE_CATALOG,
  buildAdvancedInsertTemplateVariant,
  getAdvancedInsertTemplateSections,
} from "./insertTemplates";

describe("insertTemplates", () => {
  it("contains the expected Advanced template modes and icons", () => {
    const modes = new Set(ADVANCED_INSERT_TEMPLATE_CATALOG.map((template) => template.mode));
    const requiredModes = ["cd", "cl", "cld", "help", "m1", "m2", "qa", "tf"] as const;

    requiredModes.forEach((mode) => {
      expect(modes.has(mode)).toBe(true);
    });

    ["e", "ea"].forEach((mode) => {
      expect(modes.has(mode as (typeof ADVANCED_INSERT_TEMPLATE_CATALOG)[number]["mode"])).toBe(false);
    });

    ADVANCED_INSERT_TEMPLATE_CATALOG.forEach((template) => {
      expect(typeof template.icon).toBe("string");
      expect(template.icon.length).toBeGreaterThan(0);
      if (template.insertBehavior === "direct") {
        expect(template.taskPayload).toBe(template.payload);
        expect(template.taskFirstPlaceholder).toBe(template.firstPlaceholder);
      } else {
        expect(template.taskPayload).toContain("{{TASK_NUMBER}})");
        expect(template.taskFirstPlaceholder).toBe("TASK HEADING");
      }
    });

    const labels = new Set(ADVANCED_INSERT_TEMPLATE_CATALOG.map((template) => template.label));
    expect(labels.has("Code Block")).toBe(false);
    expect(labels.has("Formula Block")).toBe(false);
    expect(labels.has("Exam Wrapper")).toBe(false);
    expect(labels.has("Exam Task Blueprint")).toBe(false);
  });

  it("keeps direct help visible inside card context while preventing nested task/card templates", () => {
    const sections = getAdvancedInsertTemplateSections({
      insideCard: true,
      insideExam: false,
    });
    const visibleModes = new Set(
      sections.flatMap((section) => section.items.map((item) => item.mode)),
    );

    ["qa", "tf", "m1", "m2", "cl", "cd", "cld"].forEach((mode) => {
      expect(visibleModes.has(mode as (typeof ADVANCED_INSERT_TEMPLATE_CATALOG)[number]["mode"])).toBe(
        false,
      );
    });
    expect(visibleModes.has("help")).toBe(true);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe("flashcard");
  });

  it("does not surface empty exam/markdown sections after removing those Advanced templates", () => {
    const sections = getAdvancedInsertTemplateSections({
      insideCard: false,
      insideExam: true,
    });

    const sectionIds = sections.map((section) => section.id);
    expect(sectionIds).not.toContain("exam");
    expect(sectionIds).not.toContain("markdown");
  });

  it("builds card and task variants for advanced templates", () => {
    ADVANCED_INSERT_TEMPLATE_CATALOG.forEach((template) => {
      const cardVariant = buildAdvancedInsertTemplateVariant(template, "card", {
        sequenceNumber: 4,
      });
      const taskVariant = buildAdvancedInsertTemplateVariant(template, "task", {
        sequenceNumber: 4,
      });

      if (template.insertBehavior === "direct") {
        expect(cardVariant.payload).toBe(template.payload);
        expect(taskVariant.payload).toBe(template.payload);
        expect(cardVariant.firstPlaceholder).toBe(template.firstPlaceholder);
        expect(taskVariant.firstPlaceholder).toBe(template.firstPlaceholder);
      } else {
        expect(cardVariant.payload).toContain("#card\n4) CARD HEADING");
        expect(cardVariant.payload).toContain("#endcard");
        expect(cardVariant.firstPlaceholder).toBe(template.firstPlaceholder);
        expect(taskVariant.payload).toContain("4) TASK HEADING");
        expect(taskVariant.payload).toContain("---");
        expect(taskVariant.firstPlaceholder).toBe("TASK HEADING");
      }
    });
  });
});
