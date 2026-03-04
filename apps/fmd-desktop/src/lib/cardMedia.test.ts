// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/lib/cardMedia.test.ts
 */

import { describe, expect, it } from "vitest";
import { parseCardMediaText, parseMediaBlockBody, validateSvgMarkup } from "./cardMedia";

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
  it("parses legacy wikilinks and exact svg fences into media items", () => {
    const media = parseCardMediaText([
      "[[images/example.png]]",
      "",
      "```svg",
      "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" /></svg>",
      "```",
    ].join("\n"));

    expect(media).toHaveLength(2);
    expect(media[0]).toMatchObject({
      type: "png",
      src: "images/example.png",
    });
    expect(media[1]?.type).toBe("svg");
    expect(media[1]?.inlineSvg).toContain("<rect");
  });

  it("drops unsupported or unclosed legacy entries", () => {
    const media = parseCardMediaText([
      "[[images/example.pdf]]",
      "```svg",
      "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" /></svg>",
      "plain text",
    ].join("\n"));

    expect(media).toHaveLength(0);
  });
});

describe("parseMediaBlockBody", () => {
  it("parses canonical png media blocks", () => {
    const media = parseMediaBlockBody([
      "type: png",
      "src: images/example.png",
      "alt: Example",
      "caption: Figure 1",
      "fit: cover",
    ].join("\n"));

    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      type: "png",
      src: "images/example.png",
      alt: "Example",
      caption: "Figure 1",
      fit: "cover",
    });
    expect(media[0]?.rawBlock).toContain("#media");
  });

  it("parses canonical svg media blocks", () => {
    const media = parseMediaBlockBody([
      "type: svg",
      "src: inline",
      "",
      "```svg",
      "<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>",
      "```",
    ].join("\n"));

    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      type: "svg",
      src: "inline",
    });
    expect(media[0]?.inlineSvg).toContain("<circle");
  });
});
