// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

const setupModule = async () => {
  vi.resetModules();

  const registered = new Set<string>();
  const core = {
    registerLanguage: vi.fn((name: string) => {
      registered.add(name);
    }),
    getLanguage: vi.fn((name: string) => (registered.has(name) ? {} : null)),
    highlight: vi.fn((code: string, options: { language: string }) => ({
      language: options.language,
      value: `<span class="hljs-keyword">${code}</span>`,
    })),
    highlightAuto: vi.fn((code: string) => ({
      language: "javascript",
      value: `<span class="hljs-keyword">${code}</span>`,
    })),
  };

  vi.doMock("highlight.js/lib/core", () => ({
    default: core,
  }));
  vi.doMock("highlight.js/lib/languages/javascript", () => ({
    default: () => ({}),
  }));

  const module = await import("./markdownCodeHighlight");
  return { module, core };
};

describe("markdownCodeHighlight performance behavior", () => {
  it("reuses cached highlight results for unchanged code blocks", async () => {
    const { module, core } = await setupModule();
    const code = "const stable = true;";

    await module.highlightMarkdownCode({ code, language: "javascript" });
    await module.highlightMarkdownCode({ code, language: "javascript" });

    expect(core.highlight).toHaveBeenCalledTimes(1);
  });

  it("rehighlights only changed blocks when most content is unchanged", async () => {
    const { module, core } = await setupModule();
    const count = 20;
    const blocks = Array.from({ length: count }, (_, index) => `const value${index} = ${index};`);

    for (const code of blocks) {
      await module.highlightMarkdownCode({ code, language: "javascript" });
    }
    expect(core.highlight).toHaveBeenCalledTimes(count);

    const changedIndex = 7;
    const nextBlocks = blocks.map((code, index) =>
      index === changedIndex ? `${code} // changed` : code,
    );
    for (const code of nextBlocks) {
      await module.highlightMarkdownCode({ code, language: "javascript" });
    }

    expect(core.highlight).toHaveBeenCalledTimes(count + 1);
  });
});
