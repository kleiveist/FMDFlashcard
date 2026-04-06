// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { DatabasePieView } from "./pie-view";
import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
} from "../database-types";

const render = (element: ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const statusGroupAttribute: DatabaseAttributeMeta = {
  key: "status",
  label: "Status",
  type: "status",
  origin: "frontmatter",
  formula: null,
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
};

const tagsGroupAttribute: DatabaseAttributeMeta = {
  ...statusGroupAttribute,
  key: "tags",
  label: "Tags",
  type: "tags",
};

const scoreAggregateAttribute: DatabaseAttributeMeta = {
  key: "Score",
  label: "Score",
  type: "score",
  origin: "frontmatter",
  formula: null,
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
};

const ownerAttribute: DatabaseAttributeMeta = {
  key: "owner",
  label: "Owner",
  type: "text",
  origin: "frontmatter",
  formula: null,
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
};

const examAttribute: DatabaseAttributeMeta = {
  key: "Exam",
  label: "Exam",
  type: "boolean",
  origin: "system",
  formula: null,
  editable: false,
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
};

const baseRecord: DatabaseRecord = {
  fileId: "a.md",
  filePath: "/vault/a.md",
  relativePath: "a.md",
  fileName: "a.md",
  folder: "",
  extension: "md",
  frontmatter: {},
  systemFields: {
    Dateiname: "A",
  },
  normalizedFields: {
    status: { raw: "Open" },
    tags: ["alpha", "beta"],
    Exam: true,
    Score: {
      raw: "20/25",
      value: 20,
      max: 25,
      ratio: 0.8,
    },
  },
};

describe("DatabasePieView", () => {
  it("shows validation message for missing group field", () => {
    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord],
        groupAttribute: null,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    expect(container.textContent).toContain("gruppierbares Feld");
    cleanup();
  });

  it("aggregates count by categorical field", () => {
    const doneRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "b.md",
      filePath: "/vault/b.md",
      relativePath: "b.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Done" },
      },
    };
    const doneRecord2: DatabaseRecord = {
      ...doneRecord,
      fileId: "b-2.md",
      filePath: "/vault/b-2.md",
      relativePath: "b-2.md",
      fileName: "b-2.md",
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, doneRecord, doneRecord2],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    expect(container.querySelectorAll(".database-pie-legend li").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Done");
    expect(container.textContent).toContain("2");

    cleanup();
  });

  it("explodes tags into separate buckets", () => {
    const secondRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "c.md",
      filePath: "/vault/c.md",
      relativePath: "c.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        tags: ["beta"],
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, secondRecord],
        groupAttribute: tagsGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    expect(container.textContent).toContain("alpha");
    expect(container.textContent).toContain("beta");
    expect(container.textContent).toContain("2");

    cleanup();
  });

  it("shows validation when numeric aggregate field is missing", () => {
    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "avg",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    expect(container.textContent).toContain("numerisches Aggregatfeld");
    cleanup();
  });

  it("aggregates score using normalized percent basis", () => {
    const secondRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "d.md",
      filePath: "/vault/d.md",
      relativePath: "d.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Open" },
        Score: {
          raw: "10/20",
          value: 10,
          max: 20,
          ratio: 0.5,
        },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, secondRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "sum",
        aggregateAttribute: scoreAggregateAttribute,
        visibleProperties: [],
      }),
    );

    // 20/25 => 80, 10/20 => 50, sum => 130
    expect(container.textContent).toContain("130");

    cleanup();
  });

  it("supports formula numeric fields as aggregate source", () => {
    const formulaAggregateAttribute: DatabaseAttributeMeta = {
      key: "scoreRatio",
      label: "Score Ratio",
      type: "number",
      origin: "formula",
      formula: "percent(score)",
      editable: false,
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
    };

    const first: DatabaseRecord = {
      ...baseRecord,
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "A" },
        scoreRatio: 80,
      },
    };

    const second: DatabaseRecord = {
      ...baseRecord,
      fileId: "formula-2.md",
      filePath: "/vault/formula-2.md",
      relativePath: "formula-2.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "A" },
        scoreRatio: 20,
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [first, second],
        groupAttribute: statusGroupAttribute,
        aggregate: "avg",
        aggregateAttribute: formulaAggregateAttribute,
        visibleProperties: [],
      }),
    );

    expect(container.textContent).toContain("50");
    cleanup();
  });

  it("renders pie legend detail samples for selected properties", () => {
    const ownerA: DatabaseRecord = {
      ...baseRecord,
      fileId: "owner-a.md",
      filePath: "/vault/owner-a.md",
      relativePath: "owner-a.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Open" },
        owner: "Alice",
      },
    };
    const ownerB: DatabaseRecord = {
      ...ownerA,
      fileId: "owner-b.md",
      filePath: "/vault/owner-b.md",
      relativePath: "owner-b.md",
      normalizedFields: {
        ...ownerA.normalizedFields,
        owner: "Bob",
      },
    };
    const ownerC: DatabaseRecord = {
      ...ownerA,
      fileId: "owner-c.md",
      filePath: "/vault/owner-c.md",
      relativePath: "owner-c.md",
      normalizedFields: {
        ...ownerA.normalizedFields,
        owner: "Cara",
      },
    };
    const ownerD: DatabaseRecord = {
      ...ownerA,
      fileId: "owner-d.md",
      filePath: "/vault/owner-d.md",
      relativePath: "owner-d.md",
      normalizedFields: {
        ...ownerA.normalizedFields,
        owner: "Dina",
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [ownerA, ownerB, ownerC, ownerD],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [ownerAttribute],
      }),
    );

    const details = container.querySelector(".database-pie-legend-details");
    expect(details).toBeTruthy();
    expect(details?.textContent).toContain("Owner");
    expect(details?.textContent).toContain("Alice");
    expect(details?.textContent).toContain("(+1 weitere)");

    cleanup();
  });

  it("keeps bucket order by first occurrence in the incoming record list", () => {
    const doneRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "done-1.md",
      filePath: "/vault/done-1.md",
      relativePath: "done-1.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Done" },
      },
    };
    const doneRecord2: DatabaseRecord = {
      ...doneRecord,
      fileId: "done-2.md",
      filePath: "/vault/done-2.md",
      relativePath: "done-2.md",
      fileName: "done-2.md",
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, doneRecord, doneRecord2],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    const labels = Array.from(container.querySelectorAll(".database-pie-legend-label"))
      .map((node) => node.textContent?.trim());
    expect(labels).toEqual(["Open", "Done"]);

    cleanup();
  });

  it("does not render Exam property inside pie legend details", () => {
    const ownerRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "owner-exam.md",
      filePath: "/vault/owner-exam.md",
      relativePath: "owner-exam.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        owner: "Alice",
        Exam: true,
      },
    };
    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [ownerRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [ownerAttribute, examAttribute],
      }),
    );

    expect(container.querySelector(".database-pie-legend-details")?.textContent ?? "")
      .not.toContain("Exam");

    cleanup();
  });
});
