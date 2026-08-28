/**
 * @file frontend/src/lib/path.test.ts
 *
 * Zweck:
 * - Testet die Hidden-Path-Logik fuer Vault-Dateien.
 *
 * Verantwortlichkeiten:
 * - Sichert Hidden-Erkennung und Filterverhalten.
 *
 * Verbunden mit:
 * - frontend/src/lib/path.ts: Hilfsfunktionen.
 * - frontend/src/lib/tree.ts: Filter fuer Vault-Dateien.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import {
  isHiddenPath,
  isPathCompatibleWithCurrentOs,
  isWindowsAbsolutePath,
  normalizeRelativePath,
} from "./path";
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

describe("isWindowsAbsolutePath", () => {
  it("detects drive-letter and UNC paths", () => {
    expect(isWindowsAbsolutePath("D:\\education\\IUFS")).toBe(true);
    expect(isWindowsAbsolutePath("C:/vault/main")).toBe(true);
    expect(isWindowsAbsolutePath("\\\\server\\share\\vault")).toBe(true);
    expect(isWindowsAbsolutePath("/home/user/vault")).toBe(false);
  });
});

describe("isPathCompatibleWithCurrentOs", () => {
  it("blocks Windows paths on non-Windows platforms", () => {
    expect(isPathCompatibleWithCurrentOs("D:\\education\\IUFS", "linux")).toBe(false);
    expect(isPathCompatibleWithCurrentOs("C:/vault/main", "darwin")).toBe(false);
  });

  it("allows Windows paths on Windows platforms", () => {
    expect(isPathCompatibleWithCurrentOs("D:\\education\\IUFS", "win32")).toBe(true);
    expect(isPathCompatibleWithCurrentOs("C:/vault/main", "Windows")).toBe(true);
  });

  it("keeps unix-like paths valid on unix-like platforms", () => {
    expect(isPathCompatibleWithCurrentOs("/home/user/.profile", "linux")).toBe(true);
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
