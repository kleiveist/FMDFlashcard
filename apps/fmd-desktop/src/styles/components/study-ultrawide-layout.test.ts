/**
 * @file apps/fmd-desktop/src/styles/components/study-ultrawide-layout.test.ts
 *
 * Contract tests for ultrawide study layout behavior.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const contentCss = readFileSync(new URL("./content.css", import.meta.url), "utf8");
const flashcardsCss = readFileSync(new URL("./flashcards.css", import.meta.url), "utf8");

describe("ultrawide study container contract", () => {
  it("registers study layouts as named inline-size containers", () => {
    expect(contentCss).toMatch(
      /\.flashcard-layout\s*\{[\s\S]*?container:\s*study-layout\s*\/\s*inline-size;[\s\S]*?\}/,
    );
    expect(contentCss).toMatch(
      /\.exam-layout\s*\{[\s\S]*?container:\s*study-layout\s*\/\s*inline-size;[\s\S]*?\}/,
    );
    expect(contentCss).toMatch(
      /\.fast-flashcard-layout\s*\{[\s\S]*?container:\s*study-layout\s*\/\s*inline-size;[\s\S]*?\}/,
    );
    expect(contentCss).toMatch(
      /\.spaced-repetition-layout\s*\{[\s\S]*?container:\s*study-layout\s*\/\s*inline-size;[\s\S]*?\}/,
    );
  });

  it("defines an ultrawide container-query card-pair layout for study lists", () => {
    expect(flashcardsCss).toMatch(
      /@container\s+study-layout\s*\(min-width:\s*2400px\)\s*\{[\s\S]*?\.flashcard-list\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?\}/,
    );
    expect(flashcardsCss).toContain(".study-ultrawide-preview-pane");
    expect(flashcardsCss).toContain(
      ".flashcard-list > .study-ultrawide-preview-pane",
    );
  });

  it("defines an ultrawide container-query task pair for exam", () => {
    expect(contentCss).toMatch(
      /@container\s+study-layout\s*\(min-width:\s*2400px\)\s*\{[\s\S]*?\.study-ultrawide-task-pair\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?\}/,
    );
    expect(contentCss).toContain(".study-ultrawide-preview-task");
    expect(contentCss).toContain(".study-ultrawide-task-pair > .study-ultrawide-preview-task");
  });

  it("keeps exam navigation right-aligned across exam, scoring, and correction panels", () => {
    expect(contentCss).toMatch(
      /\.exam-panel-nav\s*\{[\s\S]*?width:\s*100%;[\s\S]*?justify-content:\s*flex-end;[\s\S]*?\}/,
    );
    expect(contentCss).toMatch(
      /:is\(\.exam-panel,\s*\.scoring-panel\)\s+\.exam-task-footer-actions\s*\{[\s\S]*?justify-content:\s*flex-end;[\s\S]*?\}/,
    );
    expect(contentCss).toMatch(
      /:is\(\.exam-panel,\s*\.scoring-panel\)\s+\.exam-task-nav\s*\{[\s\S]*?margin-left:\s*auto;[\s\S]*?justify-content:\s*flex-end;[\s\S]*?\}/,
    );
    expect(contentCss).toMatch(
      /\.correction-panel\s+\.correction-pagination\s*\{[\s\S]*?justify-content:\s*flex-end;[\s\S]*?\}/,
    );
  });
});
