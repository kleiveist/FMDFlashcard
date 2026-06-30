/**
 * @file apps/fmd-desktop/src/styles/components/canvas-editor.test.ts
 *
 * Zweck:
 * - Verifiziert die CSS-Vertraege fuer den generischen Business-Canvas-Editor.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const previewCss = readFileSync(new URL("./preview.css", import.meta.url), "utf8");

describe("business canvas editor CSS", () => {
  it("defines the required editor surface and layer classes", () => {
    for (const selector of [
      ".business-canvas-editor",
      ".business-canvas-workbench",
      ".business-canvas-viewport",
      ".business-canvas-content",
      ".business-canvas-toolbar-layer",
      ".business-canvas-edges",
    ]) {
      expect(previewCss).toContain(selector);
    }

    expect(previewCss).toContain("height: clamp(460px, 68vh, 760px);");
    expect(previewCss).toContain("width: 2600px;");
    expect(previewCss).toContain("height: 1900px;");
    expect(previewCss).toContain("transform-origin: 0 0;");
  });

  it("keeps canvas layers explicitly stacked", () => {
    expect(previewCss).toMatch(/\.business-canvas-group-node\s*\{[\s\S]*?z-index:\s*1;/);
    expect(previewCss).toMatch(/\.business-canvas-edges\s*\{[\s\S]*?z-index:\s*2;/);
    expect(previewCss).toMatch(/\.business-canvas-selection-rect\s*\{[\s\S]*?z-index:\s*3;/);
    expect(previewCss).toMatch(/\.business-canvas-card-node\s*\{[\s\S]*?z-index:\s*4;/);
    expect(previewCss).toMatch(/\.business-canvas-node\.is-selected\s*\{[\s\S]*?z-index:\s*6;/);
    expect(previewCss).toMatch(/\.business-canvas-node\.is-dragging\s*\{[\s\S]*?z-index:\s*7;/);
    expect(previewCss).toMatch(/\.business-canvas-toolbar-layer\s*\{[\s\S]*?z-index:\s*40;/);
  });

  it("defines supported card shapes and connection hit targets", () => {
    for (const selector of [
      ".business-canvas-shape-rounded-rectangle",
      ".business-canvas-shape-rectangle",
      ".business-canvas-shape-ellipse",
      ".business-canvas-shape-diamond",
    ]) {
      expect(previewCss).toContain(selector);
    }
    expect(previewCss).toContain(".business-canvas-edges .canvas-edge-hit");
    expect(previewCss).toContain("pointer-events: stroke;");
  });
});
