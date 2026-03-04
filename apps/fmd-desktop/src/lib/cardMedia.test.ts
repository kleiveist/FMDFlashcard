// @vitest-environment jsdom
/**
 * @file apps/fmd-desktop/src/lib/cardMedia.test.ts
 */

import { describe, expect, it } from "vitest";
import { parseCardMediaText, validateSvgMarkup } from "./cardMedia";

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
  it("parses wikilinks and exact svg fences into media items", () => {
    const media = parseCardMediaText([
      "[[images/example.png]]",
      "",
      "```svg",
      "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" /></svg>",
      "```",
    ].join("\n"));

    expect(media).toHaveLength(2);
    expect(media[0]).toMatchObject({
      kind: "image",
      relativePath: "images/example.png",
    });
    expect(media[1]?.kind).toBe("svg");
    if (media[1]?.kind === "svg") {
      expect(media[1].sanitized).toContain("<rect");
    }
  });

  it("keeps unsupported and unclosed entries unresolved", () => {
    const media = parseCardMediaText([
      "[[images/example.pdf]]",
      "```svg",
      "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" /></svg>",
      "plain text",
    ].join("\n"));

    expect(media).toHaveLength(2);
    expect(media[0]).toMatchObject({
      kind: "unresolved",
      label: "Unsupported image type",
    });
    expect(media[1]).toMatchObject({
      kind: "unresolved",
      label: "Unclosed media code block",
    });
  });
});
