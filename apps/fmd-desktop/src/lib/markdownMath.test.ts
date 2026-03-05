import { describe, expect, it } from "vitest";
import {
  normalizeMultilineInlineMathOnCommit,
  tokenizeMarkdownMath,
} from "./markdownMath";

describe("tokenizeMarkdownMath", () => {
  it("detects inline math with punctuation, operators, and whitespace", () => {
    const source = "A $x_1 + y_2; z, w = 3$ B";
    const tokens = tokenizeMarkdownMath(source);
    const mathTokens = tokens.filter((token) => token.type === "inline-math");
    expect(mathTokens).toHaveLength(1);
    expect(mathTokens[0]?.type).toBe("inline-math");
    expect(mathTokens[0] && "value" in mathTokens[0] ? mathTokens[0].value : "").toBe(
      "x_1 + y_2; z, w = 3",
    );
  });

  it("detects multiple inline and display math segments in the same paragraph", () => {
    const source = "A $x$ and $y$ with $$z = x + y$$ done";
    const tokens = tokenizeMarkdownMath(source).filter((token) =>
      token.type === "inline-math" || token.type === "display-math");
    expect(tokens.map((token) => token.type)).toEqual([
      "inline-math",
      "inline-math",
      "display-math",
    ]);
    const values = tokens.map((token) => token.value);
    expect(values).toEqual(["x", "y", "z = x + y"]);
  });

  it("keeps escaped dollar delimiters as plain text", () => {
    const source = String.raw`Price is \$5 and text \$x\$`;
    const tokens = tokenizeMarkdownMath(source);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe("text");
    expect(tokens[0]?.value).toBe(source);
  });

  it("keeps unbalanced math delimiters as plain text", () => {
    const source = "Broken $x + y";
    const tokens = tokenizeMarkdownMath(source);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe("text");
    expect(tokens[0]?.value).toBe(source);
  });

  it("does not tokenize math in inline code or fenced code", () => {
    const source = [
      "Inline code: `$a$`",
      "",
      "```",
      "$b$",
      "```",
      "",
      "Visible $c$",
    ].join("\n");
    const mathTokens = tokenizeMarkdownMath(source).filter(
      (token) => token.type === "inline-math" || token.type === "display-math",
    );
    expect(mathTokens).toHaveLength(1);
    expect(mathTokens[0]?.type).toBe("inline-math");
    expect(mathTokens[0] && "value" in mathTokens[0] ? mathTokens[0].value : "").toBe("c");
  });
});

describe("normalizeMultilineInlineMathOnCommit", () => {
  it("normalizes multiline inline math to single-line content with collapsed whitespace", () => {
    const source = "A $x +\n   y$ B";
    expect(normalizeMultilineInlineMathOnCommit(source)).toBe("A $x + y$ B");
  });

  it("keeps display math unchanged", () => {
    const source = "A $$x +\n  y$$ B";
    expect(normalizeMultilineInlineMathOnCommit(source)).toBe(source);
  });

  it("does not normalize inline or fenced code content", () => {
    const source = [
      "Inline: `$x +",
      " y$`",
      "",
      "```",
      "$z +",
      " w$",
      "```",
      "",
      "Visible: $a +",
      " b$",
    ].join("\n");
    const expected = [
      "Inline: `$x +",
      " y$`",
      "",
      "```",
      "$z +",
      " w$",
      "```",
      "",
      "Visible: $a + b$",
    ].join("\n");
    expect(normalizeMultilineInlineMathOnCommit(source)).toBe(expected);
  });
});
