import { describe, expect, it } from "vitest";
import { applyDatabaseFilters } from "./database-filters";
import { type DatabaseAttributeMeta, type DatabaseRecord } from "./database-types";

const attributes: DatabaseAttributeMeta[] = [
  {
    key: "Section",
    label: "Section",
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
    key: "units",
    label: "units",
    type: "unit",
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
    key: "percent",
    label: "percent",
    type: "percent",
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
    key: "status",
    label: "status",
    type: "status",
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
    key: "tags",
    label: "tags",
    type: "tags",
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
    key: "passed",
    label: "passed",
    type: "boolean",
    origin: "computed",
    editable: false,
    sortable: true,
    filterable: true,
    aggregatable: false,
    viewCompatibility: {
      supportsTable: true,
      supportsKanbanGrouping: false,
      supportsTimeline: false,
      supportsPieGrouping: false,
      supportsAggregation: false,
    },
  },
  {
    key: "due",
    label: "due",
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
    key: "startTime",
    label: "startTime",
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
  {
    key: "Erstellt",
    label: "Erstellt",
    type: "date",
    origin: "system",
    editable: false,
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
  createRecord("a", {
    Section: "IUFS",
    Score: { raw: "20/25", value: 20, max: 25, ratio: 0.8 },
    units: 6,
    percent: { raw: "80%", value: 80 },
    status: { raw: "3 yellow", rank: 3, label: "yellow" },
    tags: ["Exam", "IUFS"],
    passed: true,
    due: new Date("2026-03-21"),
    startTime: "09:15",
    Erstellt: new Date("2026-03-01"),
  }),
  createRecord("b", {
    Section: "Other",
    Score: { raw: "10/25", value: 10, max: 25, ratio: 0.4 },
    units: 1,
    percent: { raw: "40%", value: 40 },
    status: { raw: "1 red", rank: 1, label: "red" },
    tags: ["Draft"],
    passed: false,
    due: new Date("2026-03-28"),
    startTime: "14:40",
    Erstellt: new Date("2026-04-01"),
  }),
];

describe("database-filters", () => {
  it("filters text fields with AND group", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [{ id: "rule-1", field: "Section", op: "is", value: "IUFS" }],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });

  it("filters score ratio via numeric operators", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [{ id: "rule-1", field: "Score", op: ">=", value: 0.7 }],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });

  it("filters tags with contains all", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [{ id: "rule-1", field: "tags", op: "contains all", value: ["Exam", "IUFS"] }],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });

  it("applies global search over selected fields", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [],
      },
      attributes,
      "other",
      ["Section", "status"],
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["b"]);
  });

  it("resolves fields case-insensitively", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [{ id: "rule-1", field: "section", op: "is", value: "IUFS" }],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });

  it("supports nested AND/OR groups", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "root",
        op: "and",
        rules: [
          { id: "rule-1", field: "Section", op: "is", value: "IUFS" },
          {
            id: "nested",
            op: "or",
            rules: [
              { id: "rule-2", field: "passed", op: "is true" },
              { id: "rule-3", field: "status", op: "is", value: "1 red" },
            ],
          },
        ],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });

  it("filters time fields with date operators", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [{ id: "rule-1", field: "startTime", op: "before", value: "12:00" }],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });

  it("treats unit fields as numeric filters", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [{ id: "rule-1", field: "units", op: ">=", value: 2 }],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });

  it("filters system date fields", () => {
    const filtered = applyDatabaseFilters(
      records,
      {
        id: "group-1",
        op: "and",
        rules: [{ id: "rule-1", field: "Erstellt", op: "before", value: "2026-03-15" }],
      },
      attributes,
      "",
    );

    expect(filtered.map((record) => record.fileId)).toEqual(["a"]);
  });
});
