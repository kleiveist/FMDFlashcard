/**
 * @file apps/fmd-desktop/src/styles/components/database-theme.test.ts
 *
 * Contract tests for accent- and design-mode-driven database styling.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const previewCss = readFileSync(new URL("./preview.css", import.meta.url), "utf8");
const desktopCss = readFileSync(new URL("./desktop.css", import.meta.url), "utf8");

describe("database theme contracts", () => {
  it("defines accent/frame/control/panel token groups for the database block", () => {
    const databaseBlockMatch = previewCss.match(/\.database-block\s*\{[\s\S]*?\n\}/);

    expect(databaseBlockMatch).toBeTruthy();
    const databaseBlockBody = databaseBlockMatch?.[0] ?? "";
    expect(databaseBlockBody).toContain("--db-accent-soft:");
    expect(databaseBlockBody).toContain("--db-frame-border:");
    expect(databaseBlockBody).toContain("--db-control-border:");
    expect(databaseBlockBody).toContain("--db-panel-border:");
  });

  it("defines dedicated smart and modern profiles for the database block", () => {
    expect(previewCss).toContain(':root[data-design-mode="smart"] .database-block');
    expect(previewCss).toContain(':root[data-design-mode="modern"] .database-block');

    const modernMatch = previewCss.match(
      /:root\[data-design-mode="modern"\]\s*\.database-block\s*\{([\s\S]*?)\n\}/,
    );
    const smartMatch = previewCss.match(
      /:root\[data-design-mode="smart"\]\s*\.database-block\s*\{([\s\S]*?)\n\}/,
    );

    expect(modernMatch).toBeTruthy();
    expect(smartMatch).toBeTruthy();

    const modernBody = modernMatch?.[1] ?? "";
    const smartBody = smartMatch?.[1] ?? "";
    expect(modernBody).not.toContain("--db-frame-bg:");
    expect(modernBody).not.toContain("--db-frame-bg-raised:");
    expect(modernBody).not.toContain("--db-frame-border:");
    expect(modernBody).not.toContain("white");
    expect(smartBody).not.toContain("--db-frame-bg:");
    expect(smartBody).not.toContain("--db-frame-bg-raised:");
    expect(smartBody).not.toContain("--db-frame-border:");
  });

  it("uses accent-driven active and focus states across database controls", () => {
    expect(previewCss).toMatch(
      /\.database-block-toolbar-button\.is-active\s*\{[\s\S]*?border-color:\s*var\(--db-control-active-border\);[\s\S]*?background:\s*var\(--db-control-active-bg\);[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-block-view-select:focus-visible[\s\S]*?outline:\s*2px solid var\(--db-accent-focus\);[\s\S]*?border-color:\s*var\(--db-control-active-border\);/,
    );
  });

  it("defines compact kanban order controls and visible touch selection states", () => {
    expect(previewCss).toMatch(
      /\.database-kanban-card-order-actions\s+\.database-block-toolbar-button\s*\{[\s\S]*?inline-size:\s*24px;[\s\S]*?min-inline-size:\s*24px;[\s\S]*?block-size:\s*17px;[\s\S]*?min-block-size:\s*17px;[\s\S]*?\}/,
    );
    expect(previewCss).toContain(".database-kanban-column.is-touch-source");
    expect(previewCss).toContain(".database-kanban-card.is-touch-selected");
  });

  it("keeps non-desktop dropdown and panel backgrounds opaque", () => {
    expect(previewCss).toContain("--db-panel-bg: var(--panel);");
    expect(previewCss).toMatch(
      /\.database-block-toolbar-dropdown-panel\s*\{[\s\S]*?background-color:\s*var\(--db-panel-bg,\s*var\(--panel\)\);[\s\S]*?background:\s*var\(--db-panel-bg,\s*var\(--panel\)\);[\s\S]*?background-image:\s*none;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-block-panel\s*\{[\s\S]*?background-color:\s*var\(--db-panel-bg,\s*var\(--panel\)\);[\s\S]*?background:\s*var\(--db-panel-bg,\s*var\(--panel\)\);[\s\S]*?background-image:\s*none;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /:root:not\(\[data-design-mode="desktop"\]\)\s*:is\([\s\S]*?\.database-block-view-dropdown[\s\S]*?\.database-block-search-dropdown[\s\S]*?\.database-block-properties-panel[\s\S]*?\)\s*\{[\s\S]*?background-color:\s*var\(--panel\);[\s\S]*?background:\s*var\(--panel\);[\s\S]*?background-image:\s*none;[\s\S]*?box-shadow:\s*none;[\s\S]*?\}/,
    );
  });

  it("keeps desktop mode database surfaces compact and flat", () => {
    expect(desktopCss).toMatch(
      /:root\[data-design-mode="desktop"\]\s*\.database-block\s*\{[\s\S]*?--db-radius-block:\s*8px;[\s\S]*?--db-radius-control:\s*6px;[\s\S]*?--db-radius-pill:\s*6px;[\s\S]*?--db-frame-shadow:\s*none;[\s\S]*?--db-panel-shadow:\s*none;[\s\S]*?\}/,
    );
    expect(desktopCss).toMatch(
      /:root\[data-design-mode="desktop"\]\s*:is\([\s\S]*?\.database-block-panel[\s\S]*?\.database-block-toolbar-dropdown-panel[\s\S]*?\)\s*\{[\s\S]*?box-shadow:\s*none;[\s\S]*?background-image:\s*none;[\s\S]*?\}/,
    );
  });

  it("uses two-row clipped row-meta layout for gantt/project tracks without placeholder hint selectors", () => {
    expect(previewCss).toMatch(
      /\.database-gantt-row-meta,\s*\.database-project-row-meta\s*\{[\s\S]*?max-inline-size:\s*320px;[\s\S]*?grid-template-rows:\s*repeat\(2,\s*min-content\);[\s\S]*?grid-auto-flow:\s*column;[\s\S]*?overflow:\s*hidden;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-row-meta-item\s*\{[\s\S]*?white-space:\s*nowrap;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-gantt-row-meta\s+\.database-row-meta-item,\s*\.database-project-row-meta\s+\.database-row-meta-item\s*\{[\s\S]*?margin:\s*0;[\s\S]*?line-height:\s*1;[\s\S]*?\}/,
    );
    expect(previewCss).not.toContain(".database-gantt-unscheduled-hint");
    expect(previewCss).not.toContain(".database-project-unplaced-hint");
  });

  it("keeps gantt host passive but constrains project scrolling to the local host", () => {
    expect(previewCss).toMatch(
      /\.database-gantt-grid-scroll\s*\{[\s\S]*?overflow:\s*visible;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-project-view\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-project-grid-scroll\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*auto;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-gantt-mobile-controls\s*\{[\s\S]*?display:\s*flex;[\s\S]*?\}/,
    );
    expect(previewCss).toMatch(
      /\.database-project-mobile-controls\s*\{[\s\S]*?display:\s*flex;[\s\S]*?\}/,
    );
    expect(previewCss).not.toContain(".database-gantt-sidebar-overlay");
    expect(previewCss).not.toContain(".database-project-sidebar-overlay");
  });
});
