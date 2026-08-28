/**
 * @file frontend/src/styles/components/help.test.ts
 *
 * Zweck:
 * - Verifiziert zentrale CSS-Regeln fuer das Help-Modal (Mask-Token + Groesse).
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const helpCss = readFileSync(new URL("./help.css", import.meta.url), "utf8");

describe("help.css", () => {
  it("defines help inline mask and help-modal backdrop selectors", () => {
    expect(helpCss).toContain(".help-modal-backdrop");
    expect(helpCss).toContain(".help-inline-mask");
    expect(helpCss).toContain(".help-inline-mask::after");
    expect(helpCss).toContain(".help-inline-mask.is-active");
  });

  it("uses the expanded help modal max size", () => {
    expect(helpCss).toContain("width: min(645px, calc(100vw - 32px));");
    expect(helpCss).toContain("max-width: min(645px, calc(100vw - 32px));");
    expect(helpCss).toContain("max-height: min(610px, calc(100vh - 32px));");
  });

  it("keeps help syntax layout consistently two-column", () => {
    expect(helpCss).toContain(
      "grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);",
    );
    expect(helpCss).not.toMatch(
      /@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*?\.help-syntax-layout/,
    );
  });
});
