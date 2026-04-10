/**
 * @file apps/fmd-desktop/src/styles/components/controls.test.ts
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
      ':where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="hidden"]), select, textarea)',
    );
    expect(controlsCss).toContain("border: 1px solid var(--ui-control-border);");
    expect(controlsCss).toContain("background: var(--ui-control-bg);");
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

  it("applies accent-tinted styling for select controls with text-input class", () => {
    expect(controlsCss).toContain("select.text-input");
    expect(controlsCss).toContain("--accent-hover-bg");
    expect(controlsCss).toContain("--accent-active-bg");
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
