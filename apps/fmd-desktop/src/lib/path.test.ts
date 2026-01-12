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
import { isHiddenPath } from "./path";
import { filterHiddenFiles, type VaultFile } from "./tree";

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

  it("filters hidden entries when level is 0", () => {
    const visible = filterHiddenFiles(files, 0).map((file) => file.relative_path);
    expect(visible).toEqual(["visible.md"]);
  });

  it("keeps hidden entries when level is above 0", () => {
    expect(filterHiddenFiles(files, 1)).toEqual(files);
  });
});
