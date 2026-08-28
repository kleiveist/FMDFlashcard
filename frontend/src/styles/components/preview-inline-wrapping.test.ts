/**
 * @file frontend/src/styles/components/preview-inline-wrapping.test.ts
 *
 * Zweck:
 * - Verifiziert Wrapping-Regeln fuer lange Inline-Markdown-Tokens.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error Node built-in types are not part of the browser tsconfig; runtime is Node in Vitest.
import { readFileSync } from "node:fs";

const previewCss = readFileSync(new URL("./preview.css", import.meta.url), "utf8");

const expectWrappingRules = (block: string) => {
  expect(block).toContain("display: inline-block;");
  expect(block).toContain("max-width: 100%;");
  expect(block).toContain("min-width: 0;");
  expect(block).toContain("white-space: normal;");
  expect(block).toContain("overflow-wrap: anywhere;");
  expect(block).toContain("word-break: break-word;");
  expect(block).toContain("line-break: anywhere;");
  expect(block).not.toContain("white-space: nowrap;");
};

describe("preview.css inline wrapping", () => {
  it("enforces wrapping for shared md-inline-syntax tokens", () => {
    const blockMatch = previewCss.match(
      /\.markdown-hybrid-block-preview \.md-inline-syntax,\s*[\s\S]*?\.md-preview \.md-inline-syntax\s*\{([\s\S]*?)\}/,
    );
    expect(blockMatch).toBeTruthy();
    const block = blockMatch?.[1] ?? "";
    expectWrappingRules(block);
  });

  it("keeps markdown overlay syntax tokens wrapping-friendly", () => {
    const overlayMatch = previewCss.match(
      /\.markdown-hybrid-block-editor-overlay \[data-md-inline-syntax\^="markdown-"\]\s*\{([\s\S]*?)\}/,
    );
    expect(overlayMatch).toBeTruthy();
    const block = overlayMatch?.[1] ?? "";
    expect(block).toContain("display: inline;");
    expect(block).toContain("white-space: normal;");
    expect(block).toContain("overflow-wrap: anywhere;");
    expect(block).toContain("word-break: break-word;");
    expect(block).toContain("line-break: anywhere;");
    expect(block).not.toContain("white-space: nowrap;");
  });

  it("allows inline code wrapping without changing pre/code-fence behavior", () => {
    const inlineCodeMatch = previewCss.match(
      /\.markdown-hybrid-block-editor-overlay \.md-inline-syntax-markdown-inline-code\s*\{([\s\S]*?)\}/,
    );
    expect(inlineCodeMatch).toBeTruthy();
    const inlineCodeBlock = inlineCodeMatch?.[1] ?? "";
    expectWrappingRules(inlineCodeBlock);

    const mdPreviewCodeMatch = previewCss.match(/\.md-preview code\s*\{([\s\S]*?)\}/);
    expect(mdPreviewCodeMatch).toBeTruthy();
    const mdPreviewCodeBlock = mdPreviewCodeMatch?.[1] ?? "";
    expectWrappingRules(mdPreviewCodeBlock);

    const preCodeMatch = previewCss.match(/\.md-preview pre code\s*\{([\s\S]*?)\}/);
    expect(preCodeMatch).toBeTruthy();
    const preCodeBlock = preCodeMatch?.[1] ?? "";
    expect(preCodeBlock).toContain("white-space: pre;");
    expect(preCodeBlock).toContain("overflow-wrap: normal;");
    expect(preCodeBlock).toContain("word-break: normal;");
    expect(preCodeBlock).toContain("line-break: auto;");
  });
});
