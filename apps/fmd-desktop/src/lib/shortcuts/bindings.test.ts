/**
 * @file apps/fmd-desktop/src/lib/shortcuts/bindings.test.ts
 *
 * Zweck:
 * - Tests fuer Shortcut-Normalisierung, Konflikte und Migration.
 */

import { describe, expect, it } from "vitest";
import {
  detectShortcutConflicts,
  formatBinding,
  normalizeBinding,
  normalizeKeyboardShortcuts,
} from "./bindings";
import type { ShortcutCommand } from "./registry";

describe("normalizeBinding", () => {
  it("normalizes modifiers and key casing", () => {
    expect(normalizeBinding("ctrl+shift+k")).toBe("Ctrl+Shift+K");
  });

  it("normalizes aliases", () => {
    expect(normalizeBinding("Cmd+Option+Esc")).toBe("Alt+Meta+Escape");
  });
});

describe("formatBinding", () => {
  it("formats bindings for mac labels", () => {
    expect(formatBinding("Meta+Shift+K", "mac")).toBe("Cmd+Shift+K");
  });

  it("formats arrows and escape", () => {
    expect(formatBinding("ArrowLeft")).toBe("Left");
    expect(formatBinding("Escape")).toBe("Esc");
  });
});

describe("detectShortcutConflicts", () => {
  it("detects conflicts within context and global overlaps", () => {
    const commands: ShortcutCommand[] = [
      {
        id: "global.open",
        title: "Global action",
        description: "",
        context: "global",
        defaultBinding: { winLinux: "Ctrl+K" },
      },
      {
        id: "flashcards.next",
        title: "Next",
        description: "",
        context: "flashcards",
        defaultBinding: { winLinux: "Ctrl+K" },
      },
      {
        id: "flashcards.prev",
        title: "Prev",
        description: "",
        context: "flashcards",
        defaultBinding: { winLinux: "ArrowLeft" },
      },
      {
        id: "flashcards.prev-alt",
        title: "Prev alt",
        description: "",
        context: "flashcards",
        defaultBinding: { winLinux: "ArrowLeft" },
      },
    ];

    const conflicts = detectShortcutConflicts(commands, {}, "winLinux");
    const bindings = conflicts.map((conflict) => conflict.binding);

    expect(bindings).toContain("ArrowLeft");
    expect(bindings).toContain("Ctrl+K");
  });
});

describe("normalizeKeyboardShortcuts", () => {
  it("returns defaults when empty", () => {
    const { settings, needsMigration } = normalizeKeyboardShortcuts(null);
    expect(settings.bindings).toEqual({});
    expect(settings.version).toBe(1);
    expect(needsMigration).toBe(true);
  });

  it("migrates legacy bindings shape", () => {
    const { settings, needsMigration } = normalizeKeyboardShortcuts({
      bindings: { "flashcards.focus.toggle": "ctrl+f" },
    });
    expect(settings.bindings["flashcards.focus.toggle"]).toBe("Ctrl+F");
    expect(settings.version).toBe(1);
    expect(needsMigration).toBe(true);
  });

  it("migrates bare bindings map", () => {
    const { settings, needsMigration } = normalizeKeyboardShortcuts({
      "flashcards.focus.toggle": "ctrl+f",
    });
    expect(settings.bindings["flashcards.focus.toggle"]).toBe("Ctrl+F");
    expect(needsMigration).toBe(true);
  });

  it("accepts current version", () => {
    const { settings, needsMigration } = normalizeKeyboardShortcuts({
      version: 1,
      bindings: { "flashcards.focus.toggle": "Ctrl+F" },
    });
    expect(settings.bindings["flashcards.focus.toggle"]).toBe("Ctrl+F");
    expect(needsMigration).toBe(false);
  });
});
