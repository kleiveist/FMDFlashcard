import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { extractSvgCodeBlockSource } from "./markdownSvg";

describe("extractSvgCodeBlockSource", () => {
  it("accepts svg language classes even when additional classes exist", () => {
    const children = createElement("code", { className: "hljs language-svg" }, "<svg></svg>");

    const source = extractSvgCodeBlockSource(children);

    expect(source).toBe("<svg></svg>");
  });

  it("returns null for non-svg code fences", () => {
    const children = createElement("code", { className: "language-javascript" }, "const x = 1;");

    const source = extractSvgCodeBlockSource(children);

    expect(source).toBeNull();
  });
});
