/**
 * @file apps/fmd-desktop/src/lib/shortcuts/bindings.ts
 *
 * Zweck:
 * - Normalisiert und vergleicht Shortcut-Bindings.
 *
 * Verantwortlichkeiten:
 * - Canonicalisierung von Binding-Strings und KeyboardEvents.
 * - Ableitung effektiver Bindings (Default vs Override).
 * - Konflikterkennung fuer Shortcuts.
 */

import {
  SHORTCUT_COMMANDS,
  type ShortcutCommand,
  type ShortcutContextId,
} from "./registry";

export type ShortcutPlatform = "mac" | "winLinux";

export type ShortcutUserBindings = Record<string, string | null>;

export type KeyboardShortcutSettings = {
  version: number;
  bindings: ShortcutUserBindings;
};

export const KEYBOARD_SHORTCUTS_VERSION = 1;

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutSettings = {
  version: KEYBOARD_SHORTCUTS_VERSION,
  bindings: {},
};

const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Meta"] as const;

const MODIFIER_ALIASES: Record<string, string> = {
  cmd: "Meta",
  command: "Meta",
  meta: "Meta",
  win: "Meta",
  super: "Meta",
  control: "Ctrl",
  ctrl: "Ctrl",
  option: "Alt",
  alt: "Alt",
  shift: "Shift",
};

const KEY_ALIASES: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  return: "Enter",
  enter: "Enter",
  space: "Space",
  spacebar: "Space",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
};

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const getShortcutPlatform = (): ShortcutPlatform => {
  if (typeof navigator === "undefined") {
    return "winLinux";
  }
  return /mac/i.test(navigator.platform) ? "mac" : "winLinux";
};

const normalizeKeyToken = (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (MODIFIER_ALIASES[lower]) {
    return MODIFIER_ALIASES[lower];
  }
  if (KEY_ALIASES[lower]) {
    return KEY_ALIASES[lower];
  }
  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }
  return trimmed;
};

const normalizeEventKey = (key: string) => {
  if (!key) {
    return null;
  }
  if (key === " ") {
    return "Space";
  }
  if (key === "NumpadEnter") {
    return "Enter";
  }
  const lower = key.toLowerCase();
  if (KEY_ALIASES[lower]) {
    return KEY_ALIASES[lower];
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
};

export const normalizeBinding = (binding: string | null | undefined) => {
  if (!binding) {
    return null;
  }
  const parts = binding
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = new Set<string>();
  let key: string | null = null;

  parts.forEach((part) => {
    const normalized = normalizeKeyToken(part);
    if (!normalized) {
      return;
    }
    if (MODIFIER_ORDER.includes(normalized as (typeof MODIFIER_ORDER)[number])) {
      modifiers.add(normalized);
      return;
    }
    key = normalized;
  });

  if (!key) {
    return null;
  }
  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return [...orderedModifiers, key].join("+");
};

export const formatBinding = (
  binding: string | null | undefined,
  platform: ShortcutPlatform = getShortcutPlatform(),
) => {
  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return "Unbound";
  }
  const parts = normalized.split("+");
  const formatted = parts.map((part) => {
    if (part === "Meta") {
      return platform === "mac" ? "Cmd" : "Meta";
    }
    if (part === "Alt") {
      return platform === "mac" ? "Option" : "Alt";
    }
    if (part === "Escape") {
      return "Esc";
    }
    if (part === "ArrowLeft") {
      return "Left";
    }
    if (part === "ArrowRight") {
      return "Right";
    }
    if (part === "ArrowUp") {
      return "Up";
    }
    if (part === "ArrowDown") {
      return "Down";
    }
    return part;
  });
  return formatted.join("+");
};

export const eventToBinding = (event: KeyboardEvent) => {
  if (
    event.key === "Shift" ||
    event.key === "Alt" ||
    event.key === "Control" ||
    event.key === "Meta"
  ) {
    return null;
  }

  const key = normalizeEventKey(event.key);
  if (!key) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push("Ctrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  if (event.metaKey) {
    parts.push("Meta");
  }
  parts.push(key);
  return parts.join("+");
};

export const matchesBinding = (
  event: KeyboardEvent,
  binding: string | null | undefined,
) => {
  const normalizedBinding = normalizeBinding(binding);
  if (!normalizedBinding) {
    return false;
  }
  const normalizedEvent = eventToBinding(event);
  return normalizedEvent === normalizedBinding;
};

export const getDefaultBinding = (
  command: ShortcutCommand,
  platform: ShortcutPlatform = getShortcutPlatform(),
) => {
  if (platform === "mac" && command.defaultBinding.mac) {
    return command.defaultBinding.mac;
  }
  return command.defaultBinding.winLinux;
};

export const getEffectiveBinding = (
  command: ShortcutCommand,
  bindings: ShortcutUserBindings,
  platform: ShortcutPlatform = getShortcutPlatform(),
) => {
  const override = bindings[command.id];
  if (override === null) {
    return null;
  }
  if (typeof override === "string") {
    return override;
  }
  return getDefaultBinding(command, platform);
};

export const resolveCommandById = (commandId: string) =>
  SHORTCUT_COMMANDS.find((command) => command.id === commandId) ?? null;

export type ShortcutConflict = {
  binding: string;
  commandIds: string[];
  contextIds: ShortcutContextId[];
  kind: "context" | "global";
};

export const detectShortcutConflicts = (
  commands: ShortcutCommand[],
  bindings: ShortcutUserBindings,
  platform: ShortcutPlatform = getShortcutPlatform(),
) => {
  const bindingByContext = new Map<
    string,
    { command: ShortcutCommand; contextId: ShortcutContextId }[]
  >();
  const globalBindings = new Map<string, ShortcutCommand[]>();

  commands.forEach((command) => {
    const binding = normalizeBinding(getEffectiveBinding(command, bindings, platform));
    if (!binding) {
      return;
    }
    if (command.contexts.includes("global")) {
      const existing = globalBindings.get(binding) ?? [];
      existing.push(command);
      globalBindings.set(binding, existing);
    }
    command.contexts
      .filter((contextId) => contextId !== "global")
      .forEach((contextId) => {
        const key = `${contextId}:${binding}`;
        const existing = bindingByContext.get(key) ?? [];
        existing.push({ command, contextId });
        bindingByContext.set(key, existing);
      });
  });

  const conflicts: ShortcutConflict[] = [];

  bindingByContext.forEach((group, key) => {
    if (group.length < 2) {
      return;
    }
    const [contextId, binding] = key.split(":");
    const commandIds = Array.from(
      new Set(group.map((entry) => entry.command.id)),
    );
    conflicts.push({
      binding,
      commandIds,
      contextIds: [contextId as ShortcutContextId],
      kind: "context",
    });
  });

  globalBindings.forEach((globalGroup, binding) => {
    const globalCommandIds = globalGroup.map((command) => command.id);
    if (globalGroup.length > 1) {
      conflicts.push({
        binding,
        commandIds: globalCommandIds,
        contextIds: ["global"],
        kind: "global",
      });
    }
    bindingByContext.forEach((group, key) => {
      const [contextId, contextBinding] = key.split(":");
      if (contextBinding !== binding) {
        return;
      }
      const contextCommandIds = group.map((entry) => entry.command.id);
      conflicts.push({
        binding,
        commandIds: Array.from(new Set([...globalCommandIds, ...contextCommandIds])),
        contextIds: ["global", contextId as ShortcutContextId],
        kind: "global",
      });
    });
  });

  return conflicts;
};

export const normalizeKeyboardShortcuts = (
  value: unknown,
): { settings: KeyboardShortcutSettings; needsMigration: boolean } => {
  if (!value || typeof value !== "object") {
    return { settings: DEFAULT_KEYBOARD_SHORTCUTS, needsMigration: true };
  }

  const candidate = value as {
    version?: unknown;
    bindings?: unknown;
  };

  const rawBindings = candidate.bindings;
  const hasBindingsField = Object.prototype.hasOwnProperty.call(candidate, "bindings");
  const useLegacyBindings =
    !hasBindingsField && typeof candidate.version === "undefined";
  const bindingsSource =
    rawBindings && typeof rawBindings === "object"
      ? rawBindings
      : useLegacyBindings
        ? (candidate as Record<string, unknown>)
        : null;
  const normalizedBindings: ShortcutUserBindings = {};

  if (bindingsSource && typeof bindingsSource === "object") {
    Object.entries(bindingsSource as Record<string, unknown>).forEach(
      ([key, binding]) => {
      if (binding === null) {
        normalizedBindings[key] = null;
        return;
      }
      if (typeof binding === "string") {
        normalizedBindings[key] = normalizeBinding(binding) ?? binding;
      }
    },
  );
  }

  const version =
    typeof candidate.version === "number" && Number.isFinite(candidate.version)
      ? candidate.version
      : 0;

  const settings: KeyboardShortcutSettings = {
    version: KEYBOARD_SHORTCUTS_VERSION,
    bindings: normalizedBindings,
  };

  let needsMigration =
    version !== KEYBOARD_SHORTCUTS_VERSION ||
    !bindingsSource ||
    typeof bindingsSource !== "object";

  const legacyToggleIds = [
    "flashcards.focus.toggle",
    "spaced-repetition.focus.toggle",
  ];
  const legacyExitIds = ["flashcards.focus.exit", "spaced-repetition.focus.exit"];
  const legacyStudyBindings = {
    studyPrevious: [
      "flashcards.focus.prev",
      "spaced-repetition.focus.prev",
    ],
    studyNext: [
      "flashcards.focus.next",
      "spaced-repetition.focus.next",
    ],
    studySubmit: [
      "flashcards.focus.submit",
      "spaced-repetition.focus.submit",
    ],
  };
  const legacyCloseBindings = [
    "help.topic.close",
    "vault.context-menu.close",
    "vault.create-modal.cancel",
  ];

  if (!Object.prototype.hasOwnProperty.call(normalizedBindings, "toggleViewMode")) {
    const legacyBinding = legacyToggleIds.find((id) =>
      Object.prototype.hasOwnProperty.call(normalizedBindings, id),
    );
    if (legacyBinding) {
      normalizedBindings.toggleViewMode = normalizedBindings[legacyBinding] ?? null;
      needsMigration = true;
    }
  }

  legacyToggleIds.concat(legacyExitIds).forEach((id) => {
    if (Object.prototype.hasOwnProperty.call(normalizedBindings, id)) {
      delete normalizedBindings[id];
      needsMigration = true;
    }
  });

  (Object.keys(legacyStudyBindings) as Array<
    keyof typeof legacyStudyBindings
  >).forEach((studyId) => {
    if (Object.prototype.hasOwnProperty.call(normalizedBindings, studyId)) {
      return;
    }
    const legacyIds = legacyStudyBindings[studyId];
    const legacyBinding = legacyIds.find((id) =>
      Object.prototype.hasOwnProperty.call(normalizedBindings, id),
    );
    if (legacyBinding) {
      normalizedBindings[studyId] = normalizedBindings[legacyBinding] ?? null;
      needsMigration = true;
    }
  });

  Object.values(legacyStudyBindings)
    .flat()
    .forEach((legacyId) => {
      if (Object.prototype.hasOwnProperty.call(normalizedBindings, legacyId)) {
        delete normalizedBindings[legacyId];
        needsMigration = true;
      }
    });

  if (!Object.prototype.hasOwnProperty.call(normalizedBindings, "uiCloseOrBack")) {
    const legacyCloseBinding = legacyCloseBindings.find((id) =>
      Object.prototype.hasOwnProperty.call(normalizedBindings, id),
    );
    if (legacyCloseBinding) {
      normalizedBindings.uiCloseOrBack = normalizedBindings[legacyCloseBinding] ?? null;
      needsMigration = true;
    }
  }

  legacyCloseBindings.forEach((legacyId) => {
    if (Object.prototype.hasOwnProperty.call(normalizedBindings, legacyId)) {
      delete normalizedBindings[legacyId];
      needsMigration = true;
    }
  });

  return { settings, needsMigration };
};
