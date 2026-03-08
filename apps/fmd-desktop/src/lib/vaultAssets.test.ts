/**
 * @file apps/fmd-desktop/src/lib/vaultAssets.test.ts
 *
 * Zweck:
 * - Tests fuer die Normalisierung von Cover/Asset-Pfaden.
 */

import { describe, expect, it } from "vitest";
import {
  buildVaultRelativePathCandidates,
  extractVaultAssetRelativePath,
} from "./vaultAssets";

describe("extractVaultAssetRelativePath", () => {
  it("extracts target from quoted wikilink", () => {
    expect(extractVaultAssetRelativePath("'[[assets/cover image.png]]'")).toBe(
      "assets/cover image.png",
    );
  });

  it("extracts target from wikilink alias", () => {
    expect(extractVaultAssetRelativePath("[[images/a.png|Alias]]")).toBe(
      "images/a.png",
    );
  });

  it("extracts target from image embeds with optional labels", () => {
    expect(extractVaultAssetRelativePath("![[images/a.png]]")).toBe("images/a.png");
    expect(extractVaultAssetRelativePath("![[images/a.png|Label]]")).toBe("images/a.png");
  });

  it("normalizes plain path values", () => {
    expect(extractVaultAssetRelativePath("  images\\\\A.PNG  ")).toBe("images/A.PNG");
  });

  it("rejects absolute paths and traversal escapes", () => {
    expect(extractVaultAssetRelativePath("/images/a.png")).toBeNull();
    expect(extractVaultAssetRelativePath("C:\\\\vault\\\\images\\\\a.png")).toBeNull();
    expect(extractVaultAssetRelativePath("../images/a.png")).toBeNull();
  });
});

describe("buildVaultRelativePathCandidates", () => {
  it("keeps direct normalized candidates", () => {
    expect(buildVaultRelativePathCandidates("images\\\\A.PNG")).toEqual([
      "images/A.PNG",
    ]);
  });

  it("resolves dot-segments relative to source paths", () => {
    expect(
      buildVaultRelativePathCandidates("../images/example.png", "notes/cards/lesson.md"),
    ).toEqual(["notes/images/example.png"]);
  });

  it("prevents root escape attempts", () => {
    expect(buildVaultRelativePathCandidates("../../images/example.png", "notes/lesson.md")).toEqual(
      [],
    );
  });
});
