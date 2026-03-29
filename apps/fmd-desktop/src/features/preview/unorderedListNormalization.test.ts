import { describe, expect, it } from "vitest";
import { normalizeLegacyUnorderedListIndentation } from "./unorderedListNormalization";

describe("normalizeLegacyUnorderedListIndentation", () => {
  it("normalizes deeply indented nested unordered markers to 4-space levels", () => {
    const source = ["- test", "             - text", "                    - text"].join("\n");
    const result = normalizeLegacyUnorderedListIndentation(source);

    expect(result).toBe(["- test", "    - text", "        - text"].join("\n"));
  });

  it("dedents one-space bullets to root and reanchors deep descendants", () => {
    const source = ["- test", " - text", "                    - text"].join("\n");
    const result = normalizeLegacyUnorderedListIndentation(source);

    expect(result).toBe(["- test", "- text", "    - text"].join("\n"));
  });

  it("keeps siblings aligned at the same normalized depth", () => {
    const source = [
      "- test",
      "             - text",
      "                        - text",
      "                        - text",
    ].join("\n");
    const result = normalizeLegacyUnorderedListIndentation(source);

    expect(result).toBe([
      "- test",
      "    - text",
      "        - text",
      "        - text",
    ].join("\n"));
  });

  it("adds marker spacing for compact unordered markers", () => {
    const source = ["- parent", "    -child", "        +next", "            *last"].join("\n");
    const result = normalizeLegacyUnorderedListIndentation(source);

    expect(result).toBe([
      "- parent",
      "    - child",
      "        - next",
      "            - last",
    ].join("\n"));
  });

  it("drops editor spacer blank lines between nested list descendants", () => {
    const source = [
      "- root!",
      "    - child",
      "      ",
      "           - grand",
    ].join("\n");
    const result = normalizeLegacyUnorderedListIndentation(source);

    expect(result).toBe([
      "- root!",
      "    - child",
      "        - grand",
    ].join("\n"));
  });

  it("keeps fenced code and math block contents untouched", () => {
    const source = [
      "```",
      "        - keep-code-indent",
      "```",
      "$$",
      "        - keep-math-indent",
      "$$",
    ].join("\n");

    expect(normalizeLegacyUnorderedListIndentation(source)).toBe(source);
  });

  it("skips horizontal rules and interaction markers", () => {
    const source = ["---", "-true", "-a", "- test", "        - text"].join("\n");
    const result = normalizeLegacyUnorderedListIndentation(source);

    expect(result).toBe(["---", "-true", "-a", "- test", "    - text"].join("\n"));
  });
});
