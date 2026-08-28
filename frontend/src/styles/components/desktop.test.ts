/**
 * @file frontend/src/styles/components/desktop.test.ts
 *
 * Zweck:
 * - Tests fuer Desktop-CSS-Overrides (kompakte Radien + Fokusverhalten).
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const desktopCss = readFileSync(new URL("./desktop.css", import.meta.url), "utf8");

describe("desktop.css", () => {
  it("defines small-radius baseline for desktop controls and fields", () => {
    const radiusMatch = desktopCss.match(
      /:root\[data-design-mode="desktop"\]\s*:is\(([\s\S]*?)\)\s*\{[\s\S]*?border-radius:\s*var\(--ui-radius-control\);[\s\S]*?box-shadow:\s*none;[\s\S]*?\}/,
    );

    expect(radiusMatch).toBeTruthy();

    const radiusSelectors = radiusMatch?.[1] ?? "";
    for (const selector of [
      ".primary",
      ".ghost",
      ".design-mode-option",
      ".preview-mode-button",
      ".nav-icon",
      ".nav-item",
      ".text-input",
      ".hex-input",
      ".inline-rename-input",
      ".preview-editor",
    ]) {
      expect(radiusSelectors).toContain(selector);
    }

    expect(desktopCss).toContain("border-radius: var(--ui-radius-panel);");
    expect(desktopCss).toContain("border-radius: var(--ui-radius-menu);");
    expect(desktopCss).toContain(".sidebar-active-user-avatar");
    expect(desktopCss).not.toMatch(/border-radius:\s*0\b/);
  });

  it("uses subtle resting borders for desktop controls and fields", () => {
    const baselineMatch = desktopCss.match(
      /:root\[data-design-mode="desktop"\]\s*:is\(([\s\S]*?)\)\s*\{\s*border-color:\s*var\(--ui-border-subtle\);\s*\}/,
    );

    expect(baselineMatch).toBeTruthy();

    const baselineSelectors = baselineMatch?.[1] ?? "";
    for (const selector of [
      ".ghost",
      ".design-mode-option",
      ".preview-mode-button",
      ".nav-icon",
      ".nav-item",
      ".text-input",
      ".hex-input",
      ".inline-rename-input",
      ".preview-editor",
    ]) {
      expect(baselineSelectors).toContain(selector);
    }
  });

  it("keeps hover and active feedback subtle but visible", () => {
    const interactionMatch = desktopCss.match(
      /:root\[data-design-mode="desktop"\]\s*:is\(([\s\S]*?\.ghost:hover[\s\S]*?)\)\s*\{\s*border-color:\s*var\(--ui-border-hover\);\s*\}/,
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
    expect(desktopCss).toMatch(
      /:root\[data-design-mode="desktop"\]\s*\.vault-status:hover\s*\{[\s\S]*?background:\s*var\(--ui-nav-button-hover-bg\);[\s\S]*?color:\s*var\(--accent-strong\);[\s\S]*?\}/,
    );
  });

  it("keeps preview edit-active button flat", () => {
    expect(desktopCss).toMatch(
      /:root\[data-design-mode="desktop"\]\s*\.preview-mode-button\.edit-active\s*\{\s*box-shadow:\s*none;\s*\}/,
    );
  });

  it("uses visible focus outline for text inputs with active border", () => {
    const focusMatch = desktopCss.match(
      /:root\[data-design-mode="desktop"\]\s*:is\(([\s\S]*?)\):focus-visible\s*\{([\s\S]*?)\}/,
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
    expect(focusBody).toContain("border-color: var(--ui-control-border-active);");
    expect(focusBody).toContain("box-shadow: none;");
  });

  it("keeps preview editor focus styling neutral in desktop mode", () => {
    expect(desktopCss).toContain(
      ':root[data-design-mode="desktop"] .preview-editor:focus-visible {',
    );
    expect(desktopCss).toContain("outline: none;");
    expect(desktopCss).toContain("border-color: var(--md-editor-focus-border);");
    expect(desktopCss).toContain("box-shadow: none;");
  });

  it("covers user-highlighted desktop classes", () => {
    for (const selector of [
      ".sidebar-active-user-trigger",
      ".preview-mode-button",
      ".design-mode-option",
      ".nav-icon",
    ]) {
      expect(desktopCss).toContain(selector);
    }
  });

  it("moves sidebar icon row into a desktop-only vertical rail", () => {
    expect(desktopCss).toMatch(
      /@media\s*\(min-width:\s*1201px\)\s*\{[\s\S]*?:root\[data-design-mode="desktop"\]\s*\.sidebar\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*calc\(var\(--ui-nav-button-size\) \+ var\(--ui-space-lg\)\) minmax\(0,\s*1fr\);[\s\S]*?\}/,
    );
    expect(desktopCss).toMatch(
      /:root\[data-design-mode="desktop"\]\s*\.sidebar-head\s*\{\s*display:\s*contents;\s*\}/,
    );
    expect(desktopCss).toMatch(
      /:root\[data-design-mode="desktop"\]\s*\.sidebar-icon-row\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1 \/ -1;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?border-right:\s*1px solid var\(--ui-border-subtle\);[\s\S]*?\}/,
    );
    expect(desktopCss).toMatch(
      /:root\[data-design-mode="desktop"\]\s*\.sidebar-main\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*2;[\s\S]*?\}/,
    );
    expect(desktopCss).not.toMatch(
      /:root\[data-design-mode="desktop"\][\s\S]*?layout-table/,
    );
  });

  it("keeps the app sidebar hidden for exam focus mode in desktop design", () => {
    expect(desktopCss).toMatch(
      /@media\s*\(min-width:\s*1201px\)\s*\{[\s\S]*?:root\[data-design-mode="desktop"\]\s*body\.focus-mode\s*\.app-shell\[data-active-tab="exam"\]\s*#app-sidebar\.sidebar\s*\{\s*display:\s*none;[\s\S]*?\}/,
    );
  });
});
