import { describe, expect, it } from "vitest";
import { parseExamTasks } from "../exam";
import { buildExamPointsProfile, createDefaultTypeRules } from "./pointsProfiles";
import {
  resolveExamTaskPointType,
  resolveTaskMaxPointsFromProfile,
} from "./pointsScoring";

describe("pointsScoring", () => {
  it("uses task-order profile points by task index", () => {
    const parsed = parseExamTasks(["#exam", "1) Q", "Answer: A", "---", "#examend"].join("\n"));
    const task = parsed.tasks[0];
    expect(task).toBeTruthy();
    if (!task) {
      return;
    }
    const profile = buildExamPointsProfile({
      id: "p1",
      name: "Exam",
      distribution: "task-order",
      taskCount: 3,
      maxTotalPoints: 10,
      taskPoints: [2, 3, 5],
    });
    const points = resolveTaskMaxPointsFromProfile({
      profile,
      taskIndex: task.index,
      taskType: resolveExamTaskPointType(task),
    });
    expect(points).toBe(2);
  });

  it("uses task-type profile points by detected card type", () => {
    const parsed = parseExamTasks(
      ["#exam", "1) Statement", "-true", "---", "#examend"].join("\n"),
    );
    const task = parsed.tasks[0];
    expect(task).toBeTruthy();
    if (!task) {
      return;
    }
    const rules = createDefaultTypeRules(1);
    rules.tf.points = 6;
    const profile = buildExamPointsProfile({
      id: "p2",
      name: "TrueFalse",
      distribution: "task-type",
      typeRules: rules,
    });
    const points = resolveTaskMaxPointsFromProfile({
      profile,
      taskIndex: 0,
      taskType: resolveExamTaskPointType(task),
    });
    expect(points).toBe(6);
  });
});
