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

    const serialized = serializeDatabaseBlockConfig(config);
    const lines = serialized.split("\n");

    expect(lines[0]).toBe("::::");
    expect(lines[lines.length - 1]).toBe("::::");
    expect(serialized).toContain("title: 'Serialize Test'");
    expect(serialized).toContain("- Score");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.title).toBe("Serialize Test");
    expect(reparsed.config.columns).toEqual(["Dateiname", "Score"]);
  });
});
