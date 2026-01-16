/**
 * @file apps/fmd-desktop/src/keybindings/registry.ts
 *
 * Zweck:
 * - Verknuepft Shortcut-IDs mit den dazugehoerigen Actions.
 */

import { refreshActiveVault } from "../actions/vaultActions";
import { VAULT_REFRESH } from "../actions/actionIds";

export type GlobalShortcutActions = {
  handleRescanVault: () => Promise<boolean>;
};

export type GlobalShortcutContext = {
  actions: GlobalShortcutActions;
};

export type GlobalShortcutHandler = (context: GlobalShortcutContext) => void;

export const GLOBAL_SHORTCUT_HANDLERS = new Map<string, GlobalShortcutHandler>([
  [VAULT_REFRESH, (context) => refreshActiveVault(context.actions)],
]);
