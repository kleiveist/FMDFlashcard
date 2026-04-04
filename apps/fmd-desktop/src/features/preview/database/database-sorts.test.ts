import { describe, expect, it } from "vitest";
import { applyDatabaseSorts } from "./database-sorts";
import { type DatabaseAttributeMeta, type DatabaseRecord, type DatabaseSortRule } from "./database-types";

const attributes: DatabaseAttributeMeta[] = [
  {
    key: "Rank",
    label: "Rank",
    type: "text",
    origin: "frontmatter",
    editable: true,
    sortable: true,
    filterable: true,
    aggregatable: false,
    viewCompatibility: {
      supportsTable: true,
      supportsKanbanGrouping: true,
      supportsTimeline: false,
      supportsPieGrouping: true,
      supportsAggregation: false,
    },
  },
  {
    key: "Score",
    label: "Score",
    type: "score",
    origin: "frontmatter",
    editable: true,
    sortable: true,
    filterable: true,
    aggregatable: true,
    viewCompatibility: {
      supportsTable: true,
      supportsKanbanGrouping: false,
      supportsTimeline: false,
      supportsPieGrouping: false,
      supportsAggregation: true,
    },
  },
  {
    key: "Due",
    label: "Due",
    type: "date",
    origin: "frontmatter",
    editable: true,
    sortable: true,
    filterable: true,
    aggregatable: false,
    viewCompatibility: {
      supportsTable: true,
      supportsKanbanGrouping: false,
      supportsTimeline: true,
      supportsPieGrouping: false,
      supportsAggregation: false,
    },
  },
  {
    key: "StartTime",
    label: "StartTime",
    type: "time",
    origin: "frontmatter",
    editable: true,
    sortable: true,
    filterable: true,
    aggregatable: false,
    viewCompatibility: {
      supportsTable: true,
      supportsKanbanGrouping: false,
      supportsTimeline: true,
      supportsPieGrouping: false,
      supportsAggregation: false,
    },
  },
];

const createRecord = (id: string, fields: DatabaseRecord["normalizedFields"]): DatabaseRecord => ({
  fileId: id,
  filePath: `/vault/${id}.md`,
  relativePath: `${id}.md`,
  fileName: `${id}.md`,
  folder: "",
  extension: "md",
  frontmatter: {},
  systemFields: {},
  normalizedFields: fields,
});

const records: DatabaseRecord[] = [
  createRecord("item-2", {
    Rank: "SE2",
    Score: { raw: "20/25", value: 20, max: 25, ratio: 0.8 },
    Due: new Date("2026-03-25"),
    StartTime: "09:30",
  }),
  createRecord("item-10", {
    Rank: "SE10",
    Score: { raw: "18/25", value: 18, max: 25, ratio: 0.72 },
    Due: null,
    StartTime: "14:10",
  }),
  createRecord("item-1", {
    Rank: "SE1",
    Score: { raw: "10/25", value: 10, max: 25, ratio: 0.4 },
    Due: new Date("2026-03-21"),
    StartTime: "08:45",
  }),
];

describe("database-sorts", () => {
  it("sorts naturally by text field", () => {
    const rules: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "Rank",
        dir: "asc",
        natural: true,
      },
    ];

    const sorted = applyDatabaseSorts(records, rules, attributes);
    expect(sorted.map((record) => record.fileId)).toEqual(["item-1", "item-2", "item-10"]);
  });

  it("sorts score ratios descending", () => {
    const rules: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "Score",
        dir: "desc",
      },
    ];

    const sorted = applyDatabaseSorts(records, rules, attributes);
    expect(sorted.map((record) => record.fileId)).toEqual(["item-2", "item-10", "item-1"]);
  });

  it("handles null date values with explicit null ordering", () => {
    const rules: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "Due",
        dir: "asc",
        nulls: "first",
      },
    ];

    const sorted = applyDatabaseSorts(records, rules, attributes);
    expect(sorted.map((record) => record.fileId)).toEqual(["item-10", "item-1", "item-2"]);
  });

  it("applies multi-level sort rules", () => {
    const rules: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "Score",
        dir: "desc",
      },
      {
        id: "sort-2",
        field: "Rank",
        dir: "asc",
        natural: true,
      },
    ];

    const sorted = applyDatabaseSorts(records, rules, attributes);
    expect(sorted.map((record) => record.fileId)).toEqual(["item-2", "item-10", "item-1"]);
  });

  it("resolves sort fields case-insensitively", () => {
    const rules: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "score",
        dir: "desc",
      },
    ];

    const sorted = applyDatabaseSorts(records, rules, attributes);
    expect(sorted.map((record) => record.fileId)).toEqual(["item-2", "item-10", "item-1"]);
  });

  it("sorts time values ascending", () => {
    const rules: DatabaseSortRule[] = [
      {
        id: "sort-1",
        field: "StartTime",
        dir: "asc",
      },
    ];

    const sorted = applyDatabaseSorts(records, rules, attributes);
    expect(sorted.map((record) => record.fileId)).toEqual(["item-1", "item-2", "item-10"]);
  });
});
