import { describe, expect, it } from "vitest";
import { createDefaultDatabaseBlockConfig, parseDatabaseBlockConfigFromRaw, serializeDatabaseBlockConfig } from "./database-block-parser";

describe("database-block-parser", () => {
  it("parses the new saved-views schema and applies the active view mirror", () => {
    const raw = [
      "::::",
      "title: Legacy Mirror",
      "source:",
      "  type: current-folder",
      "views:",
      "  activeViewId: view-kanban",
      "  items:",
      "    - id: view-table",
      "      name: Table View",
      "      view:",
      "        type: table",
      "      properties:",
      "        - Dateiname",
      "      filters:",
      "        op: and",
      "        rules: []",
      "      sort: []",
      "    - id: view-kanban",
      "      name: Sprint Board",
      "      view:",
      "        type: kanban",
      "        groupBy: status",
      "      properties:",
      "        - status",
      "        - owner",
      "      filters:",
      "        op: and",
      "        rules:",
      "          - field: status",
      "            op: is",
      "            value: active",
      "      sort:",
      "        - field: owner",
      "          dir: asc",
      "options:",
      "  editable: false",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.isClosed).toBe(true);
    expect(parsed.config.views.activeViewId).toBe("view-kanban");
    expect(parsed.config.views.items).toHaveLength(2);
    expect(parsed.config.title).toBe("Sprint Board");
    expect(parsed.config.view.type).toBe("kanban");
    expect(parsed.config.view.groupBy).toBe("status");
    expect(parsed.config.columns).toEqual(["status", "owner"]);
    expect(parsed.config.filters.rules).toHaveLength(1);
    expect(parsed.config.sort[0]?.field).toBe("owner");
    expect(parsed.config.propertiesByView?.table).toEqual(["status", "owner"]);
    expect(parsed.config.propertiesByView?.kanban).toEqual(["status", "owner"]);
  });

  it("migrates legacy view/properties/filter/sort data into the first saved view", () => {
    const raw = [
      "::::",
      "title: Legacy Setup",
      "view:",
      "  type: kanban",
      "  groupBy: status",
      "columns:",
      "  - Dateiname",
      "propertiesByView:",
      "  kanban:",
      "    - status",
      "    - owner",
      "filters:",
      "  op: and",
      "  rules:",
      "    - field: status",
      "      op: is",
      "      value: done",
      "sort:",
      "  - field: owner",
      "    dir: desc",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.views.items).toHaveLength(1);

    const migrated = parsed.config.views.items[0]!;
    expect(migrated.id.length).toBeGreaterThan(0);
    expect(parsed.config.views.activeViewId).toBe(migrated.id);
    expect(migrated.name).toBe("Legacy Setup");
    expect(migrated.view.type).toBe("kanban");
    expect(migrated.view.groupBy).toBe("status");
    expect(migrated.properties).toEqual(["status", "owner"]);
    expect(migrated.filters.rules).toHaveLength(1);
    expect(migrated.sort[0]?.field).toBe("owner");
    expect(parsed.config.title).toBe("Legacy Setup");
    expect(parsed.config.columns).toEqual(["status", "owner"]);
  });

  it("serializes only the new saved-views source-of-truth fields", () => {
    const config = createDefaultDatabaseBlockConfig();
    config.views = {
      activeViewId: "view-main",
      items: [
        {
          id: "view-main",
          name: "Main",
          view: {
            type: "project",
            projectStartField: "unitsstart",
            projectUnitField: "units",
            blockResolution: 200,
            defaultUnits: 2,
            projectMissingPlacement: "hide-unplaced",
          },
          properties: ["unitsstart", "units", "status"],
          filters: {
            id: "root",
            op: "and",
            rules: [
              { id: "rule-1", field: "status", op: "is", value: "open" },
            ],
          },
          sort: [
            { id: "sort-1", field: "unitsstart", dir: "asc" },
          ],
        },
      ],
    };
    config.title = "Outdated Legacy Mirror";
    config.view = { type: "table" };
    config.columns = ["Dateiname"];
    config.propertiesByView = { table: ["Dateiname"] };
    config.filters = { id: "legacy", op: "and", rules: [] };
    config.sort = [];

    const serialized = serializeDatabaseBlockConfig(config);

    expect(serialized).toContain("views:");
    expect(serialized).toContain("activeViewId: view-main");
    expect(serialized).toContain("name: Main");
    expect(serialized).toContain("type: project");
    expect(serialized).toContain("projectMissingPlacement: hide-unplaced");
    expect(serialized).toContain("      properties:");
    expect(serialized).not.toContain("\nview:\n");
    expect(serialized).not.toContain("\ncolumns:");
    expect(serialized).not.toContain("\npropertiesByView:");
    expect(serialized).not.toContain("\nfilters:");
    expect(serialized).not.toContain("\nsort:");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.title).toBe("Main");
    expect(reparsed.config.views.activeViewId).toBe("view-main");
    expect(reparsed.config.view.type).toBe("project");
    expect(reparsed.config.columns).toEqual(["unitsstart", "units", "status"]);
    expect(reparsed.config.sort[0]?.field).toBe("unitsstart");
  });

  it("preserves nested filter groups in a saved view during serialize/parse roundtrip", () => {
    const config = createDefaultDatabaseBlockConfig();
    config.views = {
      activeViewId: "view-a",
      items: [
        {
          id: "view-a",
          name: "Nested Filters",
          view: { type: "table" },
          properties: ["Dateiname", "status"],
          filters: {
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
          },
          sort: [],
        },
      ],
    };

    const serialized = serializeDatabaseBlockConfig(config);
    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.views.items).toHaveLength(1);
    expect(reparsed.config.views.items[0]?.filters.rules).toHaveLength(2);
    const nested = reparsed.config.views.items[0]?.filters.rules[1];
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

  it("returns defaults with parse error when opener is missing", () => {
    const parsed = parseDatabaseBlockConfigFromRaw("title: no marker");
    expect(parsed.isClosed).toBe(false);
    expect(parsed.errors[0]).toContain("must start");
    const defaults = createDefaultDatabaseBlockConfig();
    expect(parsed.config.title).toBe(defaults.title);
    expect(parsed.config.views.items[0]?.name).toBe(defaults.views.items[0]?.name);
    expect(parsed.config.views.activeViewId).toBe(defaults.views.activeViewId);
  });
});
