/**
 * @file frontend/src/features/settings/validateExamSettings.test.ts
 *
 * Zweck:
 * - Tests fuer validateExamSettings.
 */

import { describe, expect, it } from "vitest";
import {
  validateExamSettings,
  type ExamSettingsValidationInput,
} from "./validateExamSettings";

const buildSettings = (
  overrides: Partial<ExamSettingsValidationInput>,
): ExamSettingsValidationInput => ({
  examMaxTotalPoints: 20,
  examTaskCount: 5,
  examTaskPoints: [4, 4, 4, 4, 4],
  examDurationMinutes: 30,
  examTimeLimitEnabled: true,
  ...overrides,
});

describe("validateExamSettings", () => {
  it("flags missing task count, max points, and duration when time limit is active", () => {
    const result = validateExamSettings(
      buildSettings({
        examMaxTotalPoints: 0,
        examTaskCount: 0,
        examTaskPoints: [],
        examDurationMinutes: 0,
      }),
    );

    expect(result.map((item) => item.id)).toEqual([
      "exam.task.count",
      "exam.points.max",
      "exam.duration",
    ]);
  });

  it("flags mismatched task points sum", () => {
    const result = validateExamSettings(
      buildSettings({
        examTaskCount: 3,
        examMaxTotalPoints: 10,
        examTaskPoints: [3, 3, 3],
        examTimeLimitEnabled: false,
      }),
    );

    expect(result.map((item) => item.id)).toEqual(["exam.points.sum"]);
  });

  it("returns empty list when settings are valid", () => {
    const result = validateExamSettings(buildSettings({}));
    expect(result).toEqual([]);
  });
});
