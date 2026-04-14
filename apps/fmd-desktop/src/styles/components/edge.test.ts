/**
 * @file apps/fmd-desktop/src/styles/components/edge.test.ts
 *
 * Zweck:
 * - Tests fuer Edge-CSS-Overrides (borderless controls + Fokusverhalten).
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const edgeCss = readFileSync(new URL("./edge.css", import.meta.url), "utf8");

/*
 * 🧪 Validates the borderless baseline for edge controls and text fields.
 * 🔍 Confirms hover and active interactions stay borderless while remaining visually clear.
 * ✨ Verifies vault-status hover uses explicit background and color emphasis.
 * ♿ Checks that focus-visible keeps an accessible outline without restoring hard borders.
 * 🎯 Ensures user-requested selectors remain covered by edge overrides.
 */

describe("edge.css", () => {
  it("defines explicit borderless baseline for edge controls and fields", () => {
    const baselineMatch = edgeCss.match(
      /:root\[data-design-mode="edge"\]\s*:is\(([\s\S]*?)\)\s*\{\s*border-color:\s*transparent;\s*\}/,
    );

    expect(baselineMatch).toBeTruthy();

    const baselineSelectors = baselineMatch?.[1] ?? "";
    for (const selector of [
      ".primary",
      ".ghost",
      ".design-mode-option",
      ".preview-mode-button",
      ".nav-icon",
      ".nav-item",
      ".sidebar-active-user-trigger",
      ".vault-status",
      ".vault-status-action",
      ".vault-status-refresh",
      ".vault-status-menu-item",
      ".text-input",
      ".hex-input",
      ".inline-rename-input",
      ".preview-editor",
    ]) {
      expect(baselineSelectors).toContain(selector);
    }
  });

  it("keeps hover and active feedback borderless", () => {
    const interactionMatch = edgeCss.match(
      /:root\[data-design-mode="edge"\]\s*:is\(([\s\S]*?\.ghost:hover[\s\S]*?)\)\s*\{\s*border-color:\s*transparent;\s*\}/,
    );

    expect(interactionMatch).toBeTruthy();

    const interactionSelectors = interactionMatch?.[1] ?? "";
    for (const selector of [
      ".ghost:hover",
      ".ghost.small.active",
      ".design-mode-option.active",
      ".preview-mode-button.active",
      ".nav-icon:hover",
      ".nav-icon.active",
      ".nav-item.active",
      ".sidebar-active-user-trigger:hover",
      ".vault-status:hover",
      ".vault-status-action:hover",
      ".vault-status-refresh:hover:not(:disabled)",
    ]) {
      expect(interactionSelectors).toContain(selector);
    }
  });

  it("highlights vault-status on hover", () => {
    expect(edgeCss).toMatch(
      /:root\[data-design-mode="edge"\]\s*\.vault-status:hover\s*\{[\s\S]*?background:\s*var\(--ui-nav-button-hover-bg\);[\s\S]*?color:\s*var\(--accent-strong\);[\s\S]*?\}/,
    );
  });

  it("keeps preview edit-active button borderless", () => {
    expect(edgeCss).toMatch(
      /:root\[data-design-mode="edge"\]\s*\.preview-mode-button\.edit-active\s*\{\s*box-shadow:\s*none;\s*\}/,
    );
  });

  it("uses visible focus outline for text inputs without restoring hard borders", () => {
    const focusMatch = edgeCss.match(
      /:root\[data-design-mode="edge"\]\s*:is\(([\s\S]*?)\):focus-visible\s*\{([\s\S]*?)\}/,
    );

    expect(focusMatch).toBeTruthy();

    const focusSelectors = focusMatch?.[1] ?? "";
    for (const selector of [
      ".text-input",
      ".hex-input",
      ".inline-rename-input",
    ]) {
      expect(focusSelectors).toContain(selector);
    }

    const focusBody = focusMatch?.[2] ?? "";
    expect(focusBody).toContain("outline: var(--ui-focus-outline);");
    expect(focusBody).toContain("outline-offset: 1px;");
    expect(focusBody).toContain("border-color: transparent;");
    expect(focusBody).toContain("box-shadow: none;");
  });

  it("keeps preview editor focus styling neutral in edge mode", () => {
    expect(edgeCss).toContain(
      ':root[data-design-mode="edge"] .preview-editor:focus-visible {',
    );
    expect(edgeCss).toContain("outline: none;");
    expect(edgeCss).toContain("border-color: var(--md-editor-focus-border);");
    expect(edgeCss).toContain("box-shadow: none;");
  });

  it("covers user-highlighted edge classes", () => {
    for (const selector of [
      ".sidebar-active-user-trigger",
      ".preview-mode-button",
      ".design-mode-option",
      ".nav-icon",
    ]) {
      expect(edgeCss).toContain(selector);
    }
  });
});
