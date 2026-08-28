/**
 * @file frontend/src/styles/components/controls.test.ts
 *
 * Contract tests fuer das globale Control-Styling.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const controlsCss = readFileSync(new URL("./controls.css", import.meta.url), "utf8");

describe("controls.css", () => {
  it("defines a shared text-control baseline", () => {
    expect(controlsCss).toContain(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="hidden"]):not([data-input-scope="editor"])',
    );
    expect(controlsCss).toContain('select:not([data-input-scope="editor"])');
    expect(controlsCss).toContain('textarea:not([data-input-scope="editor"])');
    expect(controlsCss).toContain("border: 1px solid var(--ui-control-border);");
    expect(controlsCss).toContain("background: var(--ui-control-bg);");
  });

  it("excludes editor-scoped controls from global hover and focus states", () => {
    expect(controlsCss).toMatch(/textarea:not\(\[data-input-scope="editor"\]\)[\s\S]*\):hover/);
    expect(controlsCss).toMatch(/textarea:not\(\[data-input-scope="editor"\]\)[\s\S]*\):active/);
    expect(controlsCss).toMatch(/textarea:not\(\[data-input-scope="editor"\]\)[\s\S]*\):focus-visible/);
    expect(controlsCss).not.toContain("textarea):focus-visible");
  });

  it("covers readonly and disabled control states", () => {
    expect(controlsCss).toContain('[aria-readonly="true"]');
    expect(controlsCss).toContain("--ui-control-bg-readonly");
    expect(controlsCss).toContain(":disabled");
    expect(controlsCss).toContain("--ui-control-bg-disabled");
  });

  it("styles combobox and dropdown open states", () => {
    expect(controlsCss).toContain('[role="combobox"][aria-expanded="true"]');
    expect(controlsCss).toContain("select:open");
    expect(controlsCss).toContain("--ui-control-bg-open");
  });

  it("normalizes native select controls to shared input styling and themed indicators", () => {
    expect(controlsCss).toContain("select.text-input");
    expect(controlsCss).toContain(".monitoring-rules-profile-control select");
    expect(controlsCss).toContain("appearance: none;");
    expect(controlsCss).toContain("--ui-select-arrow-color");
    expect(controlsCss).toContain("padding-inline-end: calc(var(--ui-control-padding-x) + 1.35rem);");
    expect(controlsCss).toContain(":where(:not([size]), [size=\"0\"], [size=\"1\"])");
    expect(controlsCss).toContain("background-image:");
    expect(controlsCss).toContain(":open");
  });

  it("includes field-like button system for toolbar/switch controls", () => {
    const buttonMatch = controlsCss.match(
      /:is\(([^)]*\.ghost\.small[^)]*\.preview-mode-button[^)]*\.design-mode-option[^)]*\.database-block-toolbar-button[^)]*)\)\s*\{[\s\S]*?--ui-button-field-font-size|:is\(([^)]*\.ghost\.small[^)]*\.preview-mode-button[^)]*\.design-mode-option[^)]*\.database-block-toolbar-button[^)]*)\)\s*\{/,
    );

    expect(buttonMatch).toBeTruthy();
    expect(controlsCss).toContain("--ui-button-field-hover-bg");
    expect(controlsCss).toContain("--ui-button-field-active-bg");
  });

  it("maps database focus outline to database accent focus token", () => {
    expect(controlsCss).toContain(
      "--ui-control-focus-outline: 2px solid var(--db-accent-focus, var(--accent-focus-ring));",
    );
  });
});
