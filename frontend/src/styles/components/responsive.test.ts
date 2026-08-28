/**
 * @file frontend/src/styles/components/responsive.test.ts
 *
 * Contract tests for responsive study/exam panel width behavior under 1200px.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const responsiveCss = readFileSync(new URL("./responsive.css", import.meta.url), "utf8");

describe("responsive.css", () => {
  it("keeps compact top-nav content stretched to full width under 1200px", () => {
    expect(responsiveCss).toMatch(
      /@media\s*\(max-width:\s*1200px\)\s*\{[\s\S]*?\.app-shell\.compact-top-nav\s+\.content\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?margin:\s*0;[\s\S]*?\}/,
    );
  });

  it("forces study/exam main panels to fill available horizontal space under 1200px", () => {
    expect(responsiveCss).toMatch(
      /@media\s*\(max-width:\s*1200px\)\s*\{[\s\S]*?\.flashcard-panel,\s*\.fast-flashcard-panel,\s*\.sr-flashcards-panel,\s*\.exam-panel\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?justify-self:\s*stretch;[\s\S]*?align-self:\s*stretch;[\s\S]*?\}/,
    );
  });
});
