/**
 * @file apps/fmd-desktop/src/lib/path.test.ts
 *
 * Zweck:
 * - Testet die Hidden-Path-Logik fuer Vault-Dateien.
 *
 * Verantwortlichkeiten:
 * - Sichert Hidden-Erkennung und Filterverhalten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/path.ts: Hilfsfunktionen.
 * - apps/fmd-desktop/src/lib/tree.ts: Filter fuer Vault-Dateien.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import { isHiddenPath, normalizeRelativePath } from "./path";
import { filterHiddenFiles, type VaultFile } from "./tree";

describe("normalizeRelativePath", () => {
  it("converts separators, removes leading slashes and collapses duplicates", () => {
    expect(normalizeRelativePath("///images\\\\A.PNG")).toBe("images/A.PNG");
    expect(normalizeRelativePath("images//nested///file.md")).toBe("images/nested/file.md");
  });
});

describe("isHiddenPath", () => {
  it("detects dot-prefixed segments", () => {
    expect(isHiddenPath(".git/config")).toBe(true);
    expect(isHiddenPath("vault/.hidden/note.md")).toBe(true);
    expect(isHiddenPath("visible/.hidden/file.md")).toBe(true);
    expect(isHiddenPath("visible/file.md")).toBe(false);
    expect(isHiddenPath("")).toBe(false);
  });
});

describe("filterHiddenFiles", () => {
  const files: VaultFile[] = [
    { path: "/vault/.hidden/note.md", relative_path: ".hidden/note.md" },
    { path: "/vault/visible.md", relative_path: "visible.md" },
    { path: "/vault/visible/.hidden/file.md", relative_path: "visible/.hidden/file.md" },
  ];

  it("filters hidden entries when hidden folders are off", () => {
    const visible = filterHiddenFiles(files, false).map((file) => file.relative_path);
    expect(visible).toEqual(["visible.md"]);
  });

  it("keeps hidden entries when hidden folders are on", () => {
    expect(filterHiddenFiles(files, true)).toEqual(files);
  });
});
