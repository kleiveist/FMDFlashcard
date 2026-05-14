import { describe, expect, it } from "vitest";
import {
  isCanvasFilePath,
  isMarkdownFilePath,
  resolveVaultDocumentKind,
} from "./fileTypes";

describe("fileTypes", () => {
  it("recognizes markdown extensions", () => {
    expect(isMarkdownFilePath("notes/demo.md")).toBe(true);
    expect(isMarkdownFilePath("notes/demo.markdown")).toBe(true);
    expect(isMarkdownFilePath("notes/demo.mdx")).toBe(true);
    expect(isMarkdownFilePath("notes/demo.canvas")).toBe(false);
  });

  it("recognizes canvas extension", () => {
    expect(isCanvasFilePath("network/heimnetz.canvas")).toBe(true);
    expect(isCanvasFilePath("network/heimnetz.md")).toBe(false);
  });

  it("resolves document kinds", () => {
    expect(resolveVaultDocumentKind("a.md")).toBe("markdown");
    expect(resolveVaultDocumentKind("a.canvas")).toBe("canvas");
    expect(resolveVaultDocumentKind("a.txt")).toBe("unknown");
  });
});

