/**
 * @file apps/fmd-desktop/src/styles/components/preview-list-markers.test.ts
 *
 * Zweck:
 * - Verifiziert globale Listen-Marker-Regeln und Hybrid-List-Variant-Selektoren.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const previewCss = readFileSync(new URL("./preview.css", import.meta.url), "utf8");

describe("preview.css list marker variants", () => {
  it("keeps the base preview surface background neutral", () => {
    expect(previewCss).toContain("background-color: var(--md-surface-bg);");
    expect(previewCss).not.toContain(
      "background-color: var(--md-question-bg, var(--md-surface-bg));",
    );
  });

  it("defines nested unordered and ordered marker cycles for global markdown surfaces", () => {
    expect(previewCss).toContain(".md-preview ul ul");
    expect(previewCss).toContain("list-style-type: circle;");
    expect(previewCss).toContain(".md-preview ul ul ul");
    expect(previewCss).toContain("list-style-type: square;");
    expect(previewCss).toContain(".md-preview ol ol");
    expect(previewCss).toContain("list-style-type: lower-alpha;");
    expect(previewCss).toContain(".md-preview ol ol ol");
    expect(previewCss).toContain("list-style-type: lower-roman;");
    expect(previewCss).toContain(".exam-markdown ul ul");
    expect(previewCss).toContain(".flashcard-markdown ol ol");
    expect(previewCss).toContain(".markdown-table-cell-preview ul ul");
  });

  it("defines depth-aware counter styles for ordered delimiter ')' lists", () => {
    expect(previewCss).toContain('ol ol[data-md-ordered-delimiter=")"] > li::before');
    expect(previewCss).toContain('counter(md-ordered, lower-alpha) ") "');
    expect(previewCss).toContain('ol ol ol[data-md-ordered-delimiter=")"] > li::before');
    expect(previewCss).toContain('counter(md-ordered, lower-roman) ") "');
    expect(previewCss).toContain(
      '.markdown-hybrid-block-preview ol ol[data-md-ordered-delimiter=")"] > li::before',
    );
  });

  it("defines hybrid split-item marker variant selectors", () => {
    expect(previewCss).toContain('[data-md-list-marker-variant="unordered-disc"]');
    expect(previewCss).toContain('[data-md-list-marker-variant="unordered-circle"]');
    expect(previewCss).toContain('[data-md-list-marker-variant="unordered-square"]');
    expect(previewCss).toContain('[data-md-list-marker-variant="ordered-decimal"]');
    expect(previewCss).toContain('[data-md-list-marker-variant="ordered-lower-alpha"]');
    expect(previewCss).toContain('[data-md-list-marker-variant="ordered-lower-roman"]');
  });
});
