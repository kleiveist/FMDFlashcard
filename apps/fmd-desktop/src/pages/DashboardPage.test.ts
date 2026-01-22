/**
 * @file apps/fmd-desktop/src/pages/DashboardPage.test.ts
 *
 * Zweck:
 * - Tests fuer DashboardPage Preview-Default-Logik.
 */

import { describe, expect, it } from "vitest";
import { shouldApplyPreviewDefaultMode } from "./DashboardPage";

describe("shouldApplyPreviewDefaultMode", () => {
  it("applies once when settings are loaded, not editing, and in markdown view", () => {
    const result = shouldApplyPreviewDefaultMode({
      didApplyDefault: false,
      settingsLoaded: true,
      isEditing: false,
      vaultView: "markdown",
    });

    expect(result).toBe(true);
  });

  it("skips when already applied or not in markdown view", () => {
    const alreadyApplied = shouldApplyPreviewDefaultMode({
      didApplyDefault: true,
      settingsLoaded: true,
      isEditing: false,
      vaultView: "markdown",
    });
    const wrongView = shouldApplyPreviewDefaultMode({
      didApplyDefault: false,
      settingsLoaded: true,
      isEditing: false,
      vaultView: "exam",
    });

    expect(alreadyApplied).toBe(false);
    expect(wrongView).toBe(false);
  });
});
