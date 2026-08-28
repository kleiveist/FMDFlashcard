// @vitest-environment jsdom
/**
 * @file frontend/src/lib/cardMedia.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  parseCardMediaText,
  resolveMediaPngAsset,
  serializePngEmbed,
  serializeSvgFence,
  validateSvgMarkup,
} from "./cardMedia";

describe("validateSvgMarkup", () => {
  it("sanitizes scripts, event handlers, foreignObject and unsafe href values", () => {
    const result = validateSvgMarkup(`
      <svg viewBox="0 0 10 10" onclick="alert(1)">
        <script>alert(1)</script>
        <foreignObject><div>bad</div></foreignObject>
        <g onload="alert(1)">
          <use href="https://example.com/icon" />
          <circle cx="5" cy="5" r="4" />
        </g>
      </svg>
    `);

    expect(result.sanitized).toContain("<circle");
    expect(result.sanitized).not.toContain("<script");
    expect(result.sanitized).not.toContain("onclick");
    expect(result.sanitized).not.toContain("onload");
    expect(result.sanitized).not.toContain("foreignObject");
    expect(result.sanitized).not.toContain("https://example.com/icon");
  });

  it("rejects malformed or non-svg roots", () => {
    expect(validateSvgMarkup("<svg><g></svg>").sanitized).toBeNull();
    expect(validateSvgMarkup("<div>nope</div>").sanitized).toBeNull();
  });

  it("rejects empty render output after sanitizing", () => {
    const result = validateSvgMarkup("<svg><script>alert(1)</script></svg>");

    expect(result.sanitized).toBeNull();
    expect(result.invalidReason).toContain("renderable");
  });
});

describe("parseCardMediaText", () => {
  it("parses standalone embeds and svg fences into media items", () => {
    const media = parseCardMediaText([
      "![[images/example.png|Example]]",
      "",
      "```svg",
      "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" /></svg>",
      "```",
    ].join("\n"));

    expect(media).toHaveLength(2);
    expect(media[0]).toMatchObject({
      type: "png",
      src: "images/example.png",
      label: "Example",
    });
    expect(media[1]?.type).toBe("svg");
    expect(media[1]?.inlineSvg).toContain("<rect");
  });

  it("ignores inline image text and unclosed svg fences", () => {
    const media = parseCardMediaText([
      "Text ![[images/example.png]] text",
      "```svg",
      "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" /></svg>",
      "plain text",
    ].join("\n"));

    expect(media).toHaveLength(0);
  });

  it("does not parse legacy #media metadata blocks", () => {
    const media = parseCardMediaText([
      "#media",
      "type: png",
      "src: images/example.png",
      "#mediaend",
    ].join("\n"));

    expect(media).toHaveLength(0);
  });
});

describe("serialization", () => {
  it("serializes png embeds with optional labels", () => {
    expect(serializePngEmbed("images/example.png")).toBe("![[images/example.png]]");
    expect(serializePngEmbed("images/example.png", "Example")).toBe(
      "![[images/example.png|Example]]",
    );
  });

  it("serializes svg fences", () => {
    expect(
      serializeSvgFence('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>'),
    ).toBe([
      "```svg",
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>',
      "```",
    ].join("\n"));
  });
});

describe("resolveMediaPngAsset", () => {
  const createAsset = (relativePath: string) => {
    const normalized = relativePath.replace(/\\/g, "/");
    const name = normalized.split("/").pop() ?? normalized;
    return {
      path: `/vault/${normalized}`,
      relative_path: normalized,
      file_name: name,
      extension: "png" as const,
    };
  };

  const createPngItem = (src: string) => ({
    id: "media-item",
    type: "png" as const,
    src,
    rawBlock: `![[${src}]]`,
  });

  it("resolves exact relative path matches case-insensitively", () => {
    const asset = createAsset("images/example.png");
    const item = createPngItem("IMAGES/Example.PNG");

    expect(resolveMediaPngAsset(item, [asset])).toEqual(asset);
  });

  it("resolves ./ and ../ paths relative to source markdown path", () => {
    const asset = createAsset("deck/images/example.png");
    const item = createPngItem("../images/example.png");

    expect(
      resolveMediaPngAsset(item, [asset], {
        sourceRelativePath: "deck/cards/note.md",
      }),
    ).toEqual(asset);
  });

  it("falls back to a unique suffix match when exact/context candidates miss", () => {
    const asset = createAsset("assets/png/example.png");
    const item = createPngItem("png/example.png");

    expect(resolveMediaPngAsset(item, [asset])).toEqual(asset);
  });

  it("falls back to a unique basename match when suffix is not unique", () => {
    const asset = createAsset("vault-a/example.png");
    const item = createPngItem("example.png");

    expect(resolveMediaPngAsset(item, [asset])).toEqual(asset);
  });

  it("returns null for ambiguous basename fallbacks", () => {
    const item = createPngItem("example.png");
    const assets = [
      createAsset("vault-a/example.png"),
      createAsset("vault-b/example.png"),
    ];

    expect(resolveMediaPngAsset(item, assets)).toBeNull();
  });
});
