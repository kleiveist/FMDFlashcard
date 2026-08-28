import { describe, expect, it, vi } from "vitest";
import { renderMathBlockMarkup } from "./mathBlocks";

describe("mathBlocks", () => {
  it("renders a full math block through the provided runtime when the expression is valid", () => {
    const runtime = {
      renderToString: vi.fn(() => "<span class='katex'>ok</span>"),
    };

    const result = renderMathBlockMarkup(String.raw`\frac{a}{b}`, runtime);
    expect(result).toEqual({
      status: "success",
      html: "<span class='katex'>ok</span>",
    });
    expect(runtime.renderToString).toHaveBeenCalledWith(String.raw`\frac{a}{b}`, expect.any(Object));
  });

  it("renders stacked display formulas when the whole block fails but each line is valid", () => {
    const runtime = {
      renderToString: vi.fn((source: string) => {
        if (source.includes("\n")) {
          throw new Error("multi-line block failed");
        }
        return `<span class="katex">${source}</span>`;
      }),
    };

    const result = renderMathBlockMarkup([
      String.raw`\sum_{i=1}^{n}`,
      String.raw`\int_{0}^{1} x^2 dx`,
    ].join("\n"), runtime);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.html).toContain(String.raw`\sum_{i=1}^{n}`);
      expect(result.html).toContain(String.raw`\int_{0}^{1} x^2 dx`);
      expect(result.html).toContain("markdown-hybrid-math-render-line");
    }
  });

  it("returns a graceful raw fallback when the runtime cannot render the math block", () => {
    const runtime = {
      renderToString: vi.fn(() => {
        throw new Error("Unexpected token");
      }),
    };

    const result = renderMathBlockMarkup(String.raw`\badcommand{`, runtime);
    expect(result).toEqual({
      status: "error",
      message: "Unexpected token",
      raw: String.raw`\badcommand{`,
    });
  });

  it("returns a graceful fallback when no runtime is available", () => {
    const result = renderMathBlockMarkup(String.raw`\frac{a}{b}`);
    expect(result).toEqual({
      status: "error",
      message: "KaTeX is not available.",
      raw: String.raw`\frac{a}{b}`,
    });
  });
});
