/**
 * @file apps/fmd-desktop/src/features/settings/settingsNavigation.test.ts
 *
 * Zweck:
 * - Regressionstests fuer die Settings-Navigation.
 */

import { describe, expect, it } from "vitest";
import { SETTINGS_NAV_MODEL } from "./settingsNavigation";

describe("SETTINGS_NAV_MODEL", () => {
  it("keeps Data & Index as single nav item and maps Profile Source + Ex- Import as subtabs", () => {
    const navItems = SETTINGS_NAV_MODEL.filter((entry) => entry.type === "item");
    const ids: string[] = navItems.map((item) => item.id);
    const dataIndexIndex = ids.indexOf("vault-index");

    expect(ids.includes("data-sync")).toBe(false);
    expect(ids.includes("export-import")).toBe(false);
    expect(dataIndexIndex).toBeGreaterThanOrEqual(0);

    const dataIndexItem = navItems.find((item) => item.id === "vault-index");

    expect(dataIndexItem?.label).toBe("Data & Index");
    expect(dataIndexItem?.subPages?.map((subPage) => subPage.id)).toEqual([
      "vault-index",
      "data-sync",
      "export-import",
    ]);
    expect(dataIndexItem?.subPages?.map((subPage) => subPage.label)).toEqual([
      "Data & Index",
      "Profile Source",
      "Ex- Import",
    ]);
  });
});
