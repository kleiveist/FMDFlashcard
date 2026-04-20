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
            projectBarFillConfigs: [
              {
                recordId: "/vault/record-a.md",
                attributeKey: "progress",
                mode: "numeric",
                min: 0,
                max: 100,
              },
              {
                recordId: "/vault/record-b.md",
                attributeKey: "statuscode",
                mode: "text-code",
                mappings: [
                  { from: "text1", to: 10 },
                  { from: "text2", to: 20 },
                  { from: "text3", to: 100 },
                ],
              },
            ],
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
    expect(serialized).toContain("projectBarFillConfigs:");
    expect(serialized).toContain("attributeKey: progress");
    expect(serialized).toContain("mode: text-code");
    expect(serialized).toContain("mappings:");
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
    expect(reparsed.config.view.projectBarFillConfigs).toHaveLength(2);
    expect(reparsed.config.view.projectBarFillConfigs?.[0]).toMatchObject({
      recordId: "/vault/record-a.md",
      attributeKey: "progress",
      mode: "numeric",
      min: 0,
      max: 100,
    });
    expect(reparsed.config.view.projectBarFillConfigs?.[1]).toMatchObject({
      recordId: "/vault/record-b.md",
      attributeKey: "statuscode",
      mode: "text-code",
      mappings: [
        { from: "text1", to: 10 },
        { from: "text2", to: 20 },
        { from: "text3", to: 100 },
      ],
    });
    expect(reparsed.config.columns).toEqual(["unitsstart", "units", "status"]);
    expect(reparsed.config.sort[0]?.field).toBe("unitsstart");
  });

  it("normalizes invalid project bar fill configs during parse/serialize", () => {
    const raw = [
      "::::",
      "title: Project Fill",
      "views:",
      "  activeViewId: view-main",
      "  items:",
      "    - id: view-main",
      "      name: Main",
      "      view:",
      "        type: project",
      "        projectBarFillConfigs:",
      "          - recordId: /vault/a.md",
      "            attributeKey: progress",
      "            mode: numeric",
      "            min: 20",
      "            max: 10",
      "          - recordId: /vault/b.md",
      "            attributeKey: statuscode",
      "            mode: text-code",
      "            mappings:",
      "              - from: text1",
      "                to: 10",
      "              - from: \"\"",
      "                to: 30",
      "              - from: text3",
      "                to: nope",
      "          - recordId: /vault/c.md",
      "            mode: numeric",
      "            min: 0",
      "            max: 100",
      "      properties:",
      "        - Dateiname",
      "      filters:",
      "        op: and",
      "        rules: []",
      "      sort: []",
      "options:",
      "  editable: true",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    const configs = parsed.config.view.projectBarFillConfigs ?? [];
    expect(configs).toHaveLength(2);
    expect(configs[0]).toMatchObject({
      recordId: "/vault/a.md",
      attributeKey: "progress",
      mode: "numeric",
    });
    expect(configs[0]).not.toHaveProperty("min");
    expect(configs[0]).not.toHaveProperty("max");
    expect(configs[1]).toMatchObject({
      recordId: "/vault/b.md",
      attributeKey: "statuscode",
      mode: "text-code",
      mappings: [{ from: "text1", to: 10 }],
    });

    const serialized = serializeDatabaseBlockConfig(parsed.config);
    expect(serialized).toContain("projectBarFillConfigs:");
    expect(serialized).toContain("recordId: /vault/b.md");
    expect(serialized).toContain("from: text1");
    expect(serialized).not.toContain("to: nope");
  });

  it("roundtrips structured formula definitions in fields", () => {
    const config = createDefaultDatabaseBlockConfig();
    config.fields = [
      {
        key: "f-status",
        label: "f-status",
        type: "formula",
        origin: "formula",
        formulaDefinition: {
          version: 1,
          operation: "group_count",
          attributeKeys: ["Status"],
          source: {
            type: "multi-folder",
            paths: ["alpha", "beta"],
          },
          shortTextRule: {
            maxChars: 32,
            maxTokens: 3,
            requireSingleNumericCore: true,
          },
        },
      },
    ];

    const serialized = serializeDatabaseBlockConfig(config);
    expect(serialized).toContain("formulaDefinition:");
    expect(serialized).toContain("operation: group_count");
    expect(serialized).toContain("attributeKeys:");
    expect(serialized).toContain("shortTextRule:");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.fields?.[0]?.formulaDefinition).toEqual(config.fields[0]?.formulaDefinition);
  });

  it("normalizes legacy formula source history-folder to history during parse/serialize", () => {
    const raw = [
      "::::",
      "title: Legacy Formula Source",
      "source:",
      "  type: current-folder",
      "fields:",
      "  - key: f-history",
      "    label: f-history",
      "    type: formula",
      "    origin: formula",
      "    formulaDefinition:",
      "      version: 1",
      "      operation: count",
      "      attributeKeys:",
      "        - status",
      "      source:",
      "        type: history-folder",
      "      shortTextRule:",
      "        maxChars: 32",
      "        maxTokens: 3",
      "        requireSingleNumericCore: true",
      "views:",
      "  activeViewId: view-default",
      "  items:",
      "    - id: view-default",
      "      name: Legacy Formula Source",
      "      view:",
      "        type: table",
      "      properties:",
      "        - f-history",
      "      filters:",
      "        id: filter-default",
      "        op: and",
      "        rules: []",
      "      sort: []",
      "options:",
      "  editable: true",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.fields?.[0]?.formulaDefinition?.source.type).toBe("history");

    const serialized = serializeDatabaseBlockConfig(parsed.config);
    expect(serialized).toContain("        type: history");
    expect(serialized).not.toContain("history-folder");
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

  it("accepts history-folder as a source type", () => {
    const raw = [
      "::::",
      "title: History",
      "source:",
      "  type: history-folder",
      "views:",
      "  activeViewId: view-1",
      "  items:",
      "    - id: view-1",
      "      name: History",
      "      view:",
      "        type: table",
      "      properties:",
      "        - Dateiname",
      "      filters:",
      "        op: and",
      "        rules: []",
      "      sort: []",
      "options:",
      "  editable: false",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.source.type).toBe("history-folder");
  });

  it("parses and roundtrips includeHistory for multi-folder sources", () => {
    const raw = [
      "::::",
      "title: Multi + History",
      "source:",
      "  type: multi-folder",
      "  paths:",
      "    - alpha",
      "    - beta",
      "  includeHistory: true",
      "views:",
      "  activeViewId: view-1",
      "  items:",
      "    - id: view-1",
      "      name: Main",
      "      view:",
      "        type: table",
      "      properties:",
      "        - Dateiname",
      "      filters:",
      "        op: and",
      "        rules: []",
      "      sort: []",
      "options:",
      "  editable: false",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const parsed = parseDatabaseBlockConfigFromRaw(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.source).toEqual({
      type: "multi-folder",
      paths: ["alpha", "beta"],
      includeHistory: true,
    });

    const serialized = serializeDatabaseBlockConfig(parsed.config);
    expect(serialized).toContain("  includeHistory: true");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.source).toEqual({
      type: "multi-folder",
      paths: ["alpha", "beta"],
      includeHistory: true,
    });
  });

  it("does not serialize includeHistory when false", () => {
    const config = createDefaultDatabaseBlockConfig();
    config.source = {
      type: "multi-folder",
      paths: ["alpha"],
      includeHistory: false,
    };

    const serialized = serializeDatabaseBlockConfig(config);
    expect(serialized).not.toContain("includeHistory");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.source).toEqual({
      type: "multi-folder",
      paths: ["alpha"],
    });
  });

  it("keeps generated filter/sort ids stable across repeated parses", () => {
    const raw = [
      "::::",
      "title: Stable IDs",
      "views:",
      "  activeViewId: view-1",
      "  items:",
      "    - id: view-1",
      "      name: Main",
      "      view:",
      "        type: table",
      "      properties:",
      "        - Dateiname",
      "      filters:",
      "        op: and",
      "        rules:",
      "          - field: status",
      "            op: is",
      "            value: open",
      "          - op: or",
      "            rules:",
      "              - field: owner",
      "                op: is",
      "                value: alice",
      "      sort:",
      "        - field: status",
      "          dir: asc",
      "        - field: owner",
      "          dir: desc",
      "options:",
      "  editable: false",
      "  showSearch: true",
      "  showToolbar: true",
      "::::",
    ].join("\n");

    const first = parseDatabaseBlockConfigFromRaw(raw);
    const second = parseDatabaseBlockConfigFromRaw(raw);
    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);

    const firstSaved = first.config.views.items[0]!;
    const secondSaved = second.config.views.items[0]!;
    expect(firstSaved.filters.id).toBe(secondSaved.filters.id);
    expect(firstSaved.sort.map((rule) => rule.id)).toEqual(
      secondSaved.sort.map((rule) => rule.id),
    );

    const firstNested = firstSaved.filters.rules.find((entry) => "rules" in entry);
    const secondNested = secondSaved.filters.rules.find((entry) => "rules" in entry);
    expect(firstNested && "rules" in firstNested).toBe(true);
    expect(secondNested && "rules" in secondNested).toBe(true);
    if (firstNested && "rules" in firstNested && secondNested && "rules" in secondNested) {
      expect(firstNested.id).toBe(secondNested.id);
      expect(
        firstNested.rules
          .filter((entry): entry is { id: string } => "id" in entry)
          .map((entry) => entry.id),
      ).toEqual(
        secondNested.rules
          .filter((entry): entry is { id: string } => "id" in entry)
          .map((entry) => entry.id),
      );
    }
  });

  it("roundtrips kanbanOrderByGroup in saved view specs", () => {
    const config = createDefaultDatabaseBlockConfig();
    config.views = {
      activeViewId: "view-kanban",
      items: [
        {
          id: "view-kanban",
          name: "Kanban",
          view: {
            type: "kanban",
            groupBy: "status",
            kanbanOrderByGroup: {
              Open: ["a.md", "b.md"],
              Done: ["c.md"],
            },
          },
          properties: ["Dateiname", "status"],
          filters: {
            id: "root",
            op: "and",
            rules: [],
          },
          sort: [],
        },
      ],
    };

    const serialized = serializeDatabaseBlockConfig(config);
    expect(serialized).toContain("kanbanOrderByGroup:");

    const reparsed = parseDatabaseBlockConfigFromRaw(serialized);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.config.views.items[0]?.view.kanbanOrderByGroup).toEqual({
      Open: ["a.md", "b.md"],
      Done: ["c.md"],
    });
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
