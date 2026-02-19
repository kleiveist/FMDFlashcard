/**
 * @file apps/fmd-desktop/src/lib/vaultAssets.test.ts
 *
 * Zweck:
 * - Tests fuer die Normalisierung von Cover/Asset-Pfaden.
 */

import { describe, expect, it } from "vitest";
import { extractVaultAssetRelativePath } from "./vaultAssets";

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

  it("normalizes plain path values", () => {
    expect(extractVaultAssetRelativePath("  images\\\\A.PNG  ")).toBe("images/A.PNG");
  });
});

