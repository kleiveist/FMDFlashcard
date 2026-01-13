/**
 * @file apps/fmd-desktop/src/components/PreviewPanel.test.ts
 *
 * Zweck:
 * - Tests fuer PreviewPanel Markdown-Hilfslogik.
 */

import { describe, expect, it } from "vitest";
import { applyInteractionSpacing } from "./PreviewPanel";

describe("applyInteractionSpacing", () => {
  it("preserves hard breaks and keeps markers on their own lines", () => {
    const source = [
      "#exam",
      "1) Prompt line",
      "a) Option A  ",
      "b) Option B  ",
      "-b",
      "---",
      "2) Inline markers -a #card final #",
      "#examend",
    ].join("\n");

    const output = applyInteractionSpacing(source);
    const lines = output.split("\n");

    expect(lines).toContain("---");
    expect(lines).toContain("-b");
    expect(lines.some((line) => line.trim() === "#card")).toBe(true);
    expect(lines.some((line) => line.trim() === "#")).toBe(true);

    const promptLine = lines.find((line) => line.startsWith("1\\) Prompt line"));
    expect(promptLine).toBe("1\\) Prompt line  ");

    const optionLine = lines.find((line) => line.startsWith("a) Option A"));
    expect(optionLine).toBe("a) Option A  ");

    const inlineIndex = lines.findIndex((line) =>
      line.startsWith("2\\) Inline markers"),
    );
    expect(inlineIndex).toBeGreaterThan(-1);
    expect(lines[inlineIndex].endsWith("  ")).toBe(true);
    expect(lines[inlineIndex + 1].trim()).toBe("-a");
  });
});
