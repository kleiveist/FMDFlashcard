import { describe, expect, it } from "vitest";
import type { VaultFile } from "../../lib/tree";
import {
  buildPageLinkCandidates,
  detectTypedImageEmbedTrigger,
  detectTypedPageLinkTrigger,
  filterPageLinkCandidates,
  resolveTypedLinkPickerTriggerAtCaret,
} from "./pageLinkPickerShared";

describe("pageLinkPickerShared", () => {
  it("detects [[ trigger but ignores ![[ for page links", () => {
    expect(detectTypedPageLinkTrigger("Alpha [[", 8)).toEqual({
      start: 6,
      end: 8,
    });
    expect(detectTypedPageLinkTrigger("Alpha ![[", 9)).toBeNull();
  });

  it("detects ![[ trigger for image embeds", () => {
    expect(detectTypedImageEmbedTrigger("Alpha ![[", 9)).toEqual({
      start: 6,
      end: 9,
    });
    expect(detectTypedImageEmbedTrigger("Alpha [[", 8)).toBeNull();
  });

  it("resolves typed trigger near caret with ±1 fallback and preserves typed query", () => {
    expect(resolveTypedLinkPickerTriggerAtCaret("[[", 1)).toEqual({
      mode: "page",
      replaceRange: { start: 0, end: 2 },
      initialQuery: "",
    });
    expect(resolveTypedLinkPickerTriggerAtCaret("![[", 2)).toEqual({
      mode: "image",
      replaceRange: { start: 0, end: 3 },
      initialQuery: "",
    });
    expect(resolveTypedLinkPickerTriggerAtCaret("[[a", 2)).toEqual({
      mode: "page",
      replaceRange: { start: 0, end: 2 },
      initialQuery: "a",
    });
    expect(resolveTypedLinkPickerTriggerAtCaret("![[a", 3)).toEqual({
      mode: "image",
      replaceRange: { start: 0, end: 3 },
      initialQuery: "a",
    });
  });

  it("resolves triggers despite larger caret drift and keeps unclosed-line scope", () => {
    expect(resolveTypedLinkPickerTriggerAtCaret("Alpha [[Demo", 6)).toEqual({
      mode: "page",
      replaceRange: { start: 6, end: 8 },
      initialQuery: "",
    });
    expect(resolveTypedLinkPickerTriggerAtCaret("Alpha ![[Pic", 7)).toEqual({
      mode: "image",
      replaceRange: { start: 6, end: 9 },
      initialQuery: "",
    });
    expect(resolveTypedLinkPickerTriggerAtCaret("Alpha [[Done]]", 13)).toBeNull();
    expect(resolveTypedLinkPickerTriggerAtCaret("Alpha [[\nNext", 11)).toBeNull();
  });

  it("builds sorted, deduplicated page candidates from vault files", () => {
    const files: VaultFile[] = [
      { path: "/vault/Beta.md", relative_path: "Beta.md" },
      { path: "/vault/folder/Alpha.md", relative_path: "folder/Alpha.md" },
      { path: "/vault/folder/alpha.md", relative_path: "folder/alpha.md" },
      { path: "/vault/notes.txt", relative_path: "notes.txt" },
    ];

    const candidates = buildPageLinkCandidates(files);
    expect(candidates.map((entry) => entry.target)).toEqual([
      "folder/Alpha",
      "Beta",
    ]);
    expect(candidates[0]?.wikilink).toBe("[[folder/Alpha]]");
  });

  it("filters candidates by query text", () => {
    const files: VaultFile[] = [
      { path: "/vault/folder/Alpha.md", relative_path: "folder/Alpha.md" },
      { path: "/vault/Beta.md", relative_path: "Beta.md" },
    ];
    const candidates = buildPageLinkCandidates(files);

    expect(filterPageLinkCandidates(candidates, "alph").map((entry) => entry.target)).toEqual([
      "folder/Alpha",
    ]);
  });
});
