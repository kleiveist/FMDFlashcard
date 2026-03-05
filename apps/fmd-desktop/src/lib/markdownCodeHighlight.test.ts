// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

type MockCoreOptions = {
  highlightValue?: string;
  autoHighlightValue?: string;
  autoLanguage?: string;
};

const setupModule = async (options: MockCoreOptions = {}) => {
  vi.resetModules();

  const registered = new Set<string>();
  const highlightValue = options.highlightValue
    ?? "<span class=\"hljs-keyword\">const</span> value = 1;";
  const autoHighlightValue = options.autoHighlightValue
    ?? "<span class=\"hljs-keyword\">SELECT</span> 1;";
  const autoLanguage = options.autoLanguage ?? "sql";

  const core = {
    registerLanguage: vi.fn((name: string) => {
      registered.add(name);
    }),
    getLanguage: vi.fn((name: string) => (registered.has(name) ? {} : null)),
    highlight: vi.fn((_code: string, options: { language: string }) => ({
      language: options.language,
      value: highlightValue,
    })),
    highlightAuto: vi.fn((_code: string, _subset?: string[]) => ({
      language: autoLanguage,
      value: autoHighlightValue,
    })),
  };

  vi.doMock("highlight.js/lib/core", () => ({
    default: core,
  }));

  const mockLanguage = () => ({ default: () => ({}) });
  [
    "bash",
    "javascript",
    "typescript",
    "python",
    "sql",
    "yaml",
    "markdown",
  ].forEach((language) => {
    vi.doMock(`highlight.js/lib/languages/${language}`, mockLanguage);
  });

  const module = await import("./markdownCodeHighlight");
  return { module, core };
};

describe("markdownCodeHighlight", () => {
  it("normalizes aliases and className language tokens", async () => {
    const { module } = await setupModule();

    expect(module.normalizeLanguage("js")).toBe("javascript");
    expect(module.normalizeLanguage("tsx")).toBe("typescript");
    expect(module.normalizeLanguage("py")).toBe("python");
    expect(module.extractLanguageFromClassName("foo language-ts bar")).toBe("typescript");
  });

  it("highlights explicit languages and keeps canonical language names", async () => {
    const { module, core } = await setupModule();

    const result = await module.highlightMarkdownCode({
      code: "const value = 1;",
      language: "js",
    });

    expect(result.highlighted).toBe(true);
    expect(result.language).toBe("javascript");
    expect(core.highlight).toHaveBeenCalledTimes(1);
    expect(core.highlight).toHaveBeenCalledWith("const value = 1;", {
      language: "javascript",
      ignoreIllegals: true,
    });
  });

  it("returns plain code when no language is provided and auto-detect is disabled", async () => {
    const { module, core } = await setupModule();

    const result = await module.highlightMarkdownCode({
      code: "plain code",
    });

    expect(result.highlighted).toBe(false);
    expect(result.language).toBeNull();
    expect(result.html).toContain("plain code");
    expect(core.highlight).not.toHaveBeenCalled();
    expect(core.highlightAuto).not.toHaveBeenCalled();
  });

  it("supports optional auto-detect when enabled", async () => {
    const { module, core } = await setupModule();

    const result = await module.highlightMarkdownCode({
      code: "SELECT 1;",
      autoDetectWithoutLanguage: true,
      autoDetectCandidateLanguages: ["sql", "javascript"],
    });

    expect(result.highlighted).toBe(true);
    expect(result.language).toBe("sql");
    expect(core.highlightAuto).toHaveBeenCalledTimes(1);
  });

  it("falls back to plain output for unknown languages without crashing", async () => {
    const { module, core } = await setupModule();

    const result = await module.highlightMarkdownCode({
      code: "+++",
      language: "brainfuck",
    });

    expect(result.highlighted).toBe(false);
    expect(result.language).toBeNull();
    expect(result.html).toContain("+++");
    expect(core.highlight).not.toHaveBeenCalled();
  });

  it("does not auto-detect when an explicit but unsupported language is provided", async () => {
    const { module, core } = await setupModule();

    const result = await module.highlightMarkdownCode({
      code: "SELECT 1;",
      language: "unknownlang",
      autoDetectWithoutLanguage: true,
      autoDetectCandidateLanguages: ["sql", "javascript"],
    });

    expect(result.highlighted).toBe(false);
    expect(result.language).toBeNull();
    expect(core.highlightAuto).not.toHaveBeenCalled();
  });

  it("falls back to plain output when highlighted html contains unsafe tags", async () => {
    const { module } = await setupModule({
      highlightValue:
        "<span class=\"hljs-keyword\">safe</span><img src=x onerror=alert(1)>",
    });

    const result = await module.highlightMarkdownCode({
      code: "<script>alert(1)</script>",
      language: "javascript",
    });

    expect(result.highlighted).toBe(false);
    expect(result.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result.html).not.toContain("<img");
  });
});
