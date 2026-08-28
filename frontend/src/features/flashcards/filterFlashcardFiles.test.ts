/**
 * @file frontend/src/features/flashcards/filterFlashcardFiles.test.ts
 *
 * Zweck:
 * - Tests fuer filterFlashcardFiles.
 */

import { describe, expect, it, vi } from "vitest";
import { filterFlashcardFiles } from "./useFlashcards";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
}));

describe("filterFlashcardFiles", () => {
  it("keeps only files with flashcardCount > 0", () => {
    const files = [
      { path: "/a.md", relative_path: "a.md", flashcardCount: 0 },
      { path: "/b.md", relative_path: "b.md", flashcardCount: 2 },
      { path: "/c.md", relative_path: "c.md", flashcardCount: 5 },
    ];

    expect(filterFlashcardFiles(files).map((file) => file.path)).toEqual([
      "/b.md",
      "/c.md",
    ]);
  });

  it("treats missing flashcardCount as 0", () => {
    const files = [
      { path: "/a.md", relative_path: "a.md" },
      { path: "/b.md", relative_path: "b.md", flashcardCount: 1 },
    ];

    expect(filterFlashcardFiles(files).map((file) => file.path)).toEqual(["/b.md"]);
  });
});
