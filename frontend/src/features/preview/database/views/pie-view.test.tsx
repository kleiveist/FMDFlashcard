// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  DatabasePieView,
  resolveDatabasePieLayoutProfile,
} from "./pie-view";
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
  it("resolves responsive pie layout profile for wide and narrow containers", () => {
    const wide = resolveDatabasePieLayoutProfile(980);
    expect(wide.isStacked).toBe(false);
    expect(wide.chartSize).toBe(320);
    expect(wide.legendMinInlineSize).toBeGreaterThanOrEqual(240);

    const narrow = resolveDatabasePieLayoutProfile(520);
    expect(narrow.isStacked).toBe(true);
    expect(narrow.chartSize).toBeLessThanOrEqual(320);
    expect(narrow.chartSize).toBeGreaterThanOrEqual(160);
    expect(narrow.legendMinInlineSize).toBeGreaterThanOrEqual(240);

    const tiny = resolveDatabasePieLayoutProfile(180);
    expect(tiny.isStacked).toBe(true);
    expect(tiny.chartSize).toBeLessThanOrEqual(156);
    expect(tiny.legendMinInlineSize).toBeLessThanOrEqual(156);
  });

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

  it("excludes configured values from categorical pie buckets", () => {
    const doneRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "excluded-done.md",
      filePath: "/vault/excluded-done.md",
      relativePath: "excluded-done.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Done" },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, doneRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        excludedValues: ["Done"],
        visibleProperties: [],
      }),
    );

    const labels = Array.from(container.querySelectorAll(".database-pie-legend-label"))
      .map((node) => node.textContent?.trim());
    expect(labels).toEqual(["Open"]);
    expect(container.textContent).not.toContain("Done");

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

  it("filters only the disabled value when exploding multivalue pie buckets", () => {
    const secondRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "tag-filter.md",
      filePath: "/vault/tag-filter.md",
      relativePath: "tag-filter.md",
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
        excludedValues: ["alpha"],
        visibleProperties: [],
      }),
    );

    const labels = Array.from(container.querySelectorAll(".database-pie-legend-label"))
      .map((node) => node.textContent?.trim());
    expect(labels).toEqual(["beta"]);
    expect(container.textContent).toContain("2");
    expect(container.textContent).not.toContain("alpha");

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

  it("uses accent-based monochrome colors for pie segments and legend dots", () => {
    const doneRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "accent-done.md",
      filePath: "/vault/accent-done.md",
      relativePath: "accent-done.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Done" },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, doneRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    const segmentStrokes = Array.from(container.querySelectorAll(".database-pie-chart circle"))
      .slice(1)
      .map((node) => node.getAttribute("stroke") ?? "");
    const legendDots = Array.from(container.querySelectorAll<HTMLElement>(".database-pie-legend-dot"));

    expect(segmentStrokes.length).toBeGreaterThan(0);
    expect(legendDots.length).toBe(segmentStrokes.length);
    segmentStrokes.forEach((stroke) => {
      expect(stroke).toContain("color-mix(");
      expect(stroke).toContain("var(--accent");
      expect(stroke).toContain("var(--db-surface-raised)");
    });

    legendDots.forEach((dot, index) => {
      const dotColor = dot.style.getPropertyValue("--db-pie-dot-color").trim();
      expect(dotColor).toBe(segmentStrokes[index]);
      expect(dotColor).toContain("color-mix(");
      expect(dotColor).toContain("var(--accent");
    });

    cleanup();
  });

  it("creates distinct accent tone steps across multiple pie buckets", () => {
    const doneRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "tone-done.md",
      filePath: "/vault/tone-done.md",
      relativePath: "tone-done.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Done" },
      },
    };
    const reviewRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "tone-review.md",
      filePath: "/vault/tone-review.md",
      relativePath: "tone-review.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Review" },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, doneRecord, reviewRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    const segmentStrokes = Array.from(container.querySelectorAll(".database-pie-chart circle"))
      .slice(1)
      .map((node) => node.getAttribute("stroke") ?? "");

    expect(segmentStrokes).toHaveLength(3);
    expect(new Set(segmentStrokes).size).toBeGreaterThan(1);

    cleanup();
  });

  it("applies selected non-standard pie color spectrum", () => {
    const doneRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "ocean-done.md",
      filePath: "/vault/ocean-done.md",
      relativePath: "ocean-done.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Done" },
      },
    };
    const reviewRecord: DatabaseRecord = {
      ...baseRecord,
      fileId: "ocean-review.md",
      filePath: "/vault/ocean-review.md",
      relativePath: "ocean-review.md",
      normalizedFields: {
        ...baseRecord.normalizedFields,
        status: { raw: "Review" },
      },
    };

    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord, doneRecord, reviewRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        excludedValues: [],
        colorSpectrum: "ocean",
        visibleProperties: [],
      }),
    );

    const segmentStrokes = Array.from(container.querySelectorAll(".database-pie-chart circle"))
      .slice(1)
      .map((node) => node.getAttribute("stroke") ?? "");

    expect(segmentStrokes).toEqual(["#006994", "#0A9396", "#2A9D8F"]);
    segmentStrokes.forEach((stroke) => {
      expect(stroke).not.toContain("color-mix(");
      expect(stroke).not.toContain("var(--accent");
    });

    cleanup();
  });

  it("allows interactive pie circle scaling with left-drag on edge handle", () => {
    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    const view = container.querySelector<HTMLElement>(".database-pie-view");
    const chartWrap = container.querySelector<HTMLElement>(".database-pie-chart-wrap");
    const resizeGrip = container.querySelector<HTMLButtonElement>(".database-pie-resize-grip");

    expect(view?.style.getPropertyValue("--db-pie-chart-size").trim()).toBe("320px");
    expect(resizeGrip).toBeTruthy();

    act(() => {
      resizeGrip?.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
      }));
      window.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        buttons: 1,
        clientX: 220,
        clientY: 100,
      }));
      window.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: 220,
        clientY: 100,
      }));
    });

    expect(chartWrap?.classList.contains("is-resizing")).toBe(false);
    expect(view?.style.getPropertyValue("--db-pie-chart-size").trim()).toBe("448px");

    act(() => {
      resizeGrip?.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 220,
        clientY: 100,
      }));
      window.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        buttons: 1,
        clientX: -100,
        clientY: 100,
      }));
      window.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: -100,
        clientY: 100,
      }));
    });

    expect(view?.style.getPropertyValue("--db-pie-chart-size").trim()).toBe("224px");

    act(() => {
      resizeGrip?.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        button: 2,
        buttons: 2,
        clientX: 100,
        clientY: 100,
      }));
      window.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        buttons: 2,
        clientX: 260,
        clientY: 100,
      }));
      window.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        button: 2,
        buttons: 0,
        clientX: 260,
        clientY: 100,
      }));
    });

    // Right-click drag must not resize.
    expect(view?.style.getPropertyValue("--db-pie-chart-size").trim()).toBe("224px");

    cleanup();
  });

  it("shows active resizing state while left-drag is in progress", () => {
    const { container, cleanup } = render(
      createElement(DatabasePieView, {
        records: [baseRecord],
        groupAttribute: statusGroupAttribute,
        aggregate: "count",
        aggregateAttribute: null,
        visibleProperties: [],
      }),
    );

    const chartWrap = container.querySelector<HTMLElement>(".database-pie-chart-wrap");
    const resizeGrip = container.querySelector<HTMLButtonElement>(".database-pie-resize-grip");

    act(() => {
      resizeGrip?.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 120,
        clientY: 100,
      }));
    });
    expect(chartWrap?.classList.contains("is-resizing")).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: 120,
        clientY: 100,
      }));
    });
    expect(chartWrap?.classList.contains("is-resizing")).toBe(false);

    cleanup();
  });
});
