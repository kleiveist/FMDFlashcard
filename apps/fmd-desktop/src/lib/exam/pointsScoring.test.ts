import { describe, expect, it } from "vitest";
import { parseExamTasks } from "../exam";
import { buildExamPointsProfile, createDefaultTypeRules } from "./pointsProfiles";
import {
  resolveExamTaskPointTypes,
  resolveTaskMaxPointsFromProfile,
  resolveTaskTypePointsFromMap,
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
      taskTypes: resolveExamTaskPointTypes(task),
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
      taskTypes: resolveExamTaskPointTypes(task),
    });
    expect(points).toBe(6);
  });

  it("adds points for composite task types", () => {
    const parsed = parseExamTasks(
      [
        "#exam",
        "1) Mixed",
        "#card",
        "[tf]",
        "Aussage:",
        "Statement",
        "-true",
        "",
        "[m1]",
        "Welche Zahl ist prim?",
        "a) 4",
        "b) 5",
        "-b",
        "#",
        "#examend",
      ].join("\n"),
    );
    const task = parsed.tasks[0];
    expect(task).toBeTruthy();
    if (!task) {
      return;
    }

    const points = resolveTaskTypePointsFromMap({
      taskTypes: resolveExamTaskPointTypes(task),
      typePoints: {
        qa: 6,
        tf: 2,
        m1: 3,
        m2: 5,
        cl: 4,
        cd: 5,
        cld: 8,
      },
    });
    expect(points).toBe(5);
  });

  it("counts repeated card instances of the same type", () => {
    const parsed = parseExamTasks(
      [
        "#exam",
        "1) True false set",
        "#card",
        "[tf]",
        "A",
        "-true",
        "",
        "[tf]",
        "B",
        "-false",
        "",
        "[tf]",
        "C",
        "-true",
        "#",
        "#examend",
      ].join("\n"),
    );
    const task = parsed.tasks[0];
    expect(task).toBeTruthy();
    if (!task) {
      return;
    }
    const rules = createDefaultTypeRules(0);
    rules.tf.points = 2;
    const profile = buildExamPointsProfile({
      id: "p-repeat-tf",
      name: "RepeatTF",
      distribution: "task-type",
      typeRules: rules,
    });
    const points = resolveTaskMaxPointsFromProfile({
      profile,
      taskIndex: task.index,
      taskTypes: resolveExamTaskPointTypes(task),
    });
    expect(points).toBe(6);
  });

  it("adds repeated mixed types (e.g. 2x QA + 1x TF)", () => {
    const points = resolveTaskTypePointsFromMap({
      taskTypes: ["qa", "qa", "tf"],
      typePoints: {
        qa: 1,
        tf: 2,
        m1: 3,
        m2: 5,
        cl: 4,
        cd: 5,
        cld: 8,
      },
    });
    expect(points).toBe(4);
  });

  it("returns 0 when no known point types are detected", () => {
    const points = resolveTaskTypePointsFromMap({
      taskTypes: [],
      typePoints: {
        qa: 1,
        tf: 2,
        m1: 3,
        m2: 5,
        cl: 4,
        cd: 5,
        cld: 8,
      },
    });
    expect(points).toBe(0);
  });
});
