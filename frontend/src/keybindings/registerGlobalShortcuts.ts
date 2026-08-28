/**
 * @file apps/fmd-desktop/src/keybindings/registerGlobalShortcuts.ts
 *
 * Zweck:
 * - Registriert globale Shortcuts und verbindet sie mit Actions.
 */

import {
  getEffectiveBinding,
  isEditableTarget,
  matchesBinding,
  type ShortcutPlatform,
  type ShortcutUserBindings,
} from "../lib/shortcuts/bindings";
import { type ShortcutCommand, getShortcutById } from "../lib/shortcuts/registry";
import {
  GLOBAL_SHORTCUT_HANDLERS,
  type GlobalShortcutContext,
  type GlobalShortcutHandler,
} from "./registry";

type ShortcutEntry = {
  command: ShortcutCommand;
  handler: GlobalShortcutHandler;
  binding: string | null;
};

type RegisterGlobalShortcutsOptions = {
  bindings: ShortcutUserBindings;
  platform: ShortcutPlatform;
  context: GlobalShortcutContext;
};

export const registerGlobalShortcuts = ({
  bindings,
  platform,
  context,
}: RegisterGlobalShortcutsOptions) => {
  const entries: ShortcutEntry[] = [];
  GLOBAL_SHORTCUT_HANDLERS.forEach((handler, commandId) => {
    const command = getShortcutById(commandId);
    if (!command) {
      return;
    }
    const binding = getEffectiveBinding(command, bindings, platform);
    entries.push({ command, handler, binding });
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    const targetEditable = isEditableTarget(event.target);
    for (const entry of entries) {
      if (!entry.binding) {
        continue;
      }
      if (!entry.command.allowInTextInputs && targetEditable) {
        continue;
      }
      if (!matchesBinding(event, entry.binding)) {
        continue;
      }
      event.preventDefault();
      entry.handler(context);
      break;
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
};
