import { describe, expect, it } from "vitest";
import { createDefaultDatabaseBlockConfig, parseDatabaseBlockConfigFromRaw, serializeDatabaseBlockConfig } from "./database-block-parser";

describe("database-block-parser", () => {
  it("parses a valid :::: database block config", () => {
    const raw = [
      "::::",
      "title: Exam Uebersicht",
      "source:",
      "  type: explicit-folder",
      "  path: UI-OnlineTest",
      "view:",
      "  type: table",
      "fields:",
      "  - key: ProgressLabel",
      "    label: Progress Label",
      "    type: formula",
      "    origin: formula",
      "    formula: 'concat(percent, \" / \", status)'",
      "columns:",
      "  - Section",
      "  - Rank",
      "filters:",
      "  op: and",
      "  rules:",
      "    - field: Section",
      "      op: is",
      "      value: IUFS",
      "sort:",
      "  - field: Rank",
      "    dir: asc",
      "options:",
      "  editable: false",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.isClosed).toBe(true);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.title).toBe("Exam Uebersicht");
    expect(parsed.config.source.type).toBe("explicit-folder");
    expect(parsed.config.source.path).toBe("UI-OnlineTest");
    expect(parsed.config.fields ?? []).toHaveLength(1);
    expect((parsed.config.fields ?? [])[0]).toEqual({
      key: "ProgressLabel",
      label: "Progress Label",
      type: "formula",
      origin: "formula",
      formula: "concat(percent, \" / \", status)",
    });
    expect(parsed.config.columns).toEqual(["Section", "Rank"]);
    expect(parsed.config.filters.op).toBe("and");
    expect(parsed.config.sort).toHaveLength(1);
    expect(parsed.config.sort[0]?.field).toBe("Rank");
  });

  it("returns defaults with parse error when opener is missing", () => {
    const parsed = parseDatabaseBlockConfigFromRaw("title: no marker");
    expect(parsed.isClosed).toBe(false);
    expect(parsed.errors[0]).toContain("must start");
    const defaults = createDefaultDatabaseBlockConfig();
    expect(parsed.config.title).toBe(defaults.title);
    expect(parsed.config.source.type).toBe(defaults.source.type);
    expect(parsed.config.view.type).toBe(defaults.view.type);
    expect(parsed.config.columns).toEqual(defaults.columns);
    expect(parsed.config.options).toEqual(defaults.options);
  });

  it("reports missing closing marker and still parses body", () => {
    const raw = [
      "::::",
      "title: Incomplete",
      "source:",
      "  type: current-folder",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.isClosed).toBe(false);
    expect(parsed.errors.join(" ")).toContain("missing the closing");
    expect(parsed.config.title).toBe("Incomplete");
  });

  it("keeps explicit empty columns array", () => {
    const raw = [
      "::::",
      "title: Empty Columns",
      "columns: []",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.columns).toEqual([]);
  });

  it("serializes config with :::: markers", () => {
    const config = createDefaultDatabaseBlockConfig();
    config.title = "Serialize Test";
    config.columns = ["Dateiname", "Score"];
    config.fields = [
      {
        key: "ScoreRatio",
        type: "percent",
        origin: "formula",
        formula: "percent(score)",
      },
    ];

    const serialized = serializeDatabaseBlockConfig(config);
    const lines = serialized.split("\n");

    expect(lines[0]).toBe("::::");
    expect(lines[lines.length - 1]).toBe("::::");
    expect(serialized).toContain("title: 'Serialize Test'");
    expect(serialized).toContain("fields:");
    expect(serialized).toContain("key: ScoreRatio");
    expect(serialized).toContain("- Score");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.title).toBe("Serialize Test");
    expect((reparsed.config.fields ?? [])[0]?.formula).toBe("percent(score)");
    expect(reparsed.config.columns).toEqual(["Dateiname", "Score"]);
  });

  it("roundtrips multi-folder sources with fields", () => {
    const raw = [
      "::::",
      "title: Folder Mix",
      "source:",
      "  type: multi-folder",
      "  paths:",
      "    - Exams",
      "    - Tasks/Sub",
      "fields:",
      "  - key: ScoreBucket",
      "    type: text",
      "    origin: formula",
      "    formula: 'if(percent(Score) >= 50, \"pass\", \"fail\")'",
      "columns:",
      "  - ScoreBucket",
      "options:",
      "  editable: false",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.source.type).toBe("multi-folder");
    expect(parsed.config.source.paths).toEqual(["Exams", "Tasks/Sub"]);
    expect((parsed.config.fields ?? [])[0]?.key).toBe("ScoreBucket");

    const serialized = serializeDatabaseBlockConfig(parsed.config);
    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.source.type).toBe("multi-folder");
    expect(reparsed.config.source.paths).toEqual(["Exams", "Tasks/Sub"]);
    expect((reparsed.config.fields ?? [])[0]?.formula).toBe("if(percent(Score) >= 50, \"pass\", \"fail\")");
  });

  it("roundtrips complete gantt/pie view config including gantt zoom", () => {
    const raw = [
      "::::",
      "title: View Roundtrip",
      "view:",
      "  type: pie",
      "  timelineStartField: startDate",
      "  timelineEndField: dueDate",
      "  timelineMode: datetime",
      "  timelineBaseDate: 2026-04-01",
      "  ganttZoom: quarter",
      "  pieGroupField: status",
      "  pieAggregate: avg",
      "  pieAggregateField: percent",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.view.timelineStartField).toBe("startDate");
    expect(parsed.config.view.timelineEndField).toBe("dueDate");
    expect(parsed.config.view.timelineMode).toBe("datetime");
    expect(parsed.config.view.timelineBaseDate).toBe("2026-04-01");
    expect(parsed.config.view.ganttZoom).toBe("quarter");
    expect(parsed.config.view.pieGroupField).toBe("status");
    expect(parsed.config.view.pieAggregate).toBe("avg");
    expect(parsed.config.view.pieAggregateField).toBe("percent");

    const serialized = serializeDatabaseBlockConfig(parsed.config);
    expect(serialized).toContain("timelineStartField: startDate");
    expect(serialized).toContain("timelineEndField: dueDate");
    expect(serialized).toContain("timelineMode: datetime");
    expect(serialized).toContain("timelineBaseDate: 2026-04-01");
    expect(serialized).toContain("ganttZoom: quarter");
    expect(serialized).toContain("pieGroupField: status");
    expect(serialized).toContain("pieAggregate: avg");
    expect(serialized).toContain("pieAggregateField: percent");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.view.timelineStartField).toBe("startDate");
    expect(reparsed.config.view.timelineEndField).toBe("dueDate");
    expect(reparsed.config.view.timelineMode).toBe("datetime");
    expect(reparsed.config.view.timelineBaseDate).toBe("2026-04-01");
    expect(reparsed.config.view.ganttZoom).toBe("quarter");
    expect(reparsed.config.view.pieGroupField).toBe("status");
    expect(reparsed.config.view.pieAggregate).toBe("avg");
    expect(reparsed.config.view.pieAggregateField).toBe("percent");
  });

  it("parses extended timeline zoom values and mode defaults", () => {
    const raw = [
      "::::",
      "title: Timeline Defaults",
      "view:",
      "  type: gantt",
      "  timelineMode: time",
      "  ganttZoom: minute",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.view.timelineMode).toBe("time");
    expect(parsed.config.view.ganttZoom).toBe("minute");
    expect(parsed.config.view.timelineBaseDate).toBeNull();
  });

  it("preserves nested filter groups during serialize/parse roundtrip", () => {
    const config = createDefaultDatabaseBlockConfig();
    config.filters = {
      id: "root",
      op: "and",
      rules: [
        { id: "rule-1", field: "Section", op: "is", value: "IUFS" },
        {
          id: "group-1",
          op: "or",
          rules: [
            { id: "rule-2", field: "status", op: "is", value: "3 🟡" },
            {
              id: "group-2",
              op: "and",
              rules: [{ id: "rule-3", field: "percent", op: ">=", value: 50 }],
            },
          ],
        },
      ],
    };

    const serialized = serializeDatabaseBlockConfig(config);
    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.filters.rules).toHaveLength(2);
    const nested = reparsed.config.filters.rules[1];
    expect(nested && "rules" in nested).toBe(true);
    if (nested && "rules" in nested) {
      expect(nested.rules).toHaveLength(2);
      const deepNested = nested.rules[1];
      expect(deepNested && "rules" in deepNested).toBe(true);
      if (deepNested && "rules" in deepNested) {
        expect(deepNested.rules).toHaveLength(1);
      }
    }
  });
});
