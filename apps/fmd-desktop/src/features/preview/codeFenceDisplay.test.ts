import { describe, expect, it } from "vitest";
import {
  buildBacktickFenceDisplayHints,
  normalizeFenceDisplayForRender,
  scanStandaloneBacktickFences,
} from "./codeFenceDisplay";

describe("scanStandaloneBacktickFences", () => {
  it("detects standalone closed backtick fences only", () => {
    const markdown = [
      "Alpha `inline` test",
      "```js",
      "const value = 1;",
      "```",
      "",
      "Text ```not a standalone fence",
      "",
      "```ts",
      "const openOnly = true;",
    ].join("\n");

    const fences = scanStandaloneBacktickFences(markdown);
    expect(fences).toHaveLength(1);
    expect(fences[0]).toMatchObject({
      openLineIndex: 1,
      closeLineIndex: 3,
      openLineRaw: "```js",
      closeLineRaw: "```",
    });
  });
});

describe("normalizeFenceDisplayForRender", () => {
  it("normalizes only fence boundary alignment while preserving code content", () => {
    const markdown = [
      "     ```sql",
      "\tSELECT * FROM users;",
      "      WHERE active = 1;",
      "     ```",
    ].join("\n");

    const normalized = normalizeFenceDisplayForRender(markdown);
    expect(normalized).toBe([
      "```sql",
      "\tSELECT * FROM users;",
      "      WHERE active = 1;",
      "```",
    ].join("\n"));
  });

  it("keeps likely list-scoped fences unchanged to avoid list flow regressions", () => {
    const markdown = [
      "- item",
      "    ```js",
      "    const value = 1;",
      "    ```",
      "- next",
    ].join("\n");

    expect(normalizeFenceDisplayForRender(markdown)).toBe(markdown);
  });
});

describe("buildBacktickFenceDisplayHints", () => {
  it("returns source and display fence lines in block order", () => {
    const markdown = [
      "  ```http",
      "GET /book/1",
      "  ```",
      "",
      "```txt",
      "A",
      "```",
    ].join("\n");

    const hints = buildBacktickFenceDisplayHints(markdown);
    expect(hints).toEqual([
      {
        openSourceLine: "  ```http",
        closeSourceLine: "  ```",
        openDisplayLine: "```http",
        closeDisplayLine: "```",
      },
      {
        openSourceLine: "```txt",
        closeSourceLine: "```",
        openDisplayLine: "```txt",
        closeDisplayLine: "```",
      },
    ]);
  });
});
