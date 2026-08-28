import { describe, expect, it } from "vitest";
import { importMathLatex } from "./importer";
import { serializeRow } from "./serializer";

describe("math-editor importer", () => {
  it("roundtrips a nested fraction power expression", () => {
    const latex = String.raw`\left(\frac{x_1}{y}\right)^2`;
    const result = importMathLatex(latex);
    expect(result.mode).toBe("structured");
    if (result.mode === "structured") {
      expect(serializeRow(result.ast)).toBe(String.raw`\left(\frac{x_{1}}{y}\right)^{2}`);
    }
  });

  it("roundtrips aligned blocks", () => {
    const latex = [
      String.raw`\begin{aligned}`,
      String.raw`a &= b \\`,
      String.raw`c &= d`,
      String.raw`\end{aligned}`,
    ].join("\n");
    const result = importMathLatex(latex);
    expect(result.mode).toBe("structured");
    if (result.mode === "structured") {
      expect(serializeRow(result.ast)).toBe(latex);
    }
  });

  it("falls back to raw mode for unsupported commands", () => {
    const result = importMathLatex(String.raw`\unknownmacro{x}`);
    expect(result.mode).toBe("raw-fallback");
    if (result.mode === "raw-fallback") {
      expect(result.reason).toContain("Unsupported command");
    }
  });
});
