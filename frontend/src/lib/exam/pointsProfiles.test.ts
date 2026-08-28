import { describe, expect, it } from "vitest";
import {
  EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  EXAM_POINTS_MAX_TASK_COUNT,
  EXAM_POINTS_MAX_DURATION_MINUTES,
  buildExamPointsProfile,
  normalizeExamPointsProfile,
} from "./pointsProfiles";

describe("pointsProfiles duration", () => {
  it("defaults duration when profile data has no duration field", () => {
    const normalized = normalizeExamPointsProfile({
      id: "profile-1",
      name: "Exam",
      distribution: "task-order",
      taskCount: 5,
      maxTotalPoints: 20,
    });
    expect(normalized.durationMinutes).toBe(EXAM_POINTS_DEFAULT_DURATION_MINUTES);
  });

  it("clamps duration to the allowed max", () => {
    const profile = buildExamPointsProfile({
      id: "profile-2",
      name: "Exam",
      durationMinutes: EXAM_POINTS_MAX_DURATION_MINUTES + 999,
    });
    expect(profile.durationMinutes).toBe(EXAM_POINTS_MAX_DURATION_MINUTES);
  });

  it("clamps task count to the shared max", () => {
    const profile = normalizeExamPointsProfile({
      id: "profile-3",
      name: "Exam",
      taskCount: EXAM_POINTS_MAX_TASK_COUNT + 999,
      maxTotalPoints: 20,
    });
    expect(profile.taskCount).toBe(EXAM_POINTS_MAX_TASK_COUNT);
  });
});
