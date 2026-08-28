/**
 * @file apps/fmd-desktop/src/lib/theme.test.ts
 *
 * Zweck:
 * - Tests fuer Theme-Helfer (Design-Mode Datensatz).
 */

import { describe, expect, it } from "vitest";
import { applyDesignMode } from "./theme";

describe("theme helpers", () => {
  it("applies desktop design mode on the document root dataset", () => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      const previousMode = root.dataset.designMode;
      try {
        applyDesignMode("desktop");
        expect(root.dataset.designMode).toBe("desktop");
      } finally {
        if (typeof previousMode === "string") {
          root.dataset.designMode = previousMode;
        } else {
          delete root.dataset.designMode;
        }
      }
      return;
    }

    const root = { dataset: {} as DOMStringMap };
    const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        documentElement: root,
      },
    });

    try {
      applyDesignMode("desktop");
      expect(root.dataset.designMode).toBe("desktop");
    } finally {
      if (previousDescriptor) {
        Object.defineProperty(globalThis, "document", previousDescriptor);
      } else {
        delete (globalThis as { document?: Document }).document;
      }
    }
  });
});
