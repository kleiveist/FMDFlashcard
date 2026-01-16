/**
 * @file apps/fmd-desktop/src/actions/vaultActions.ts
 *
 * Zweck:
 * - Uebernimmt Vault-bezogene Aktionen fuer die Keybinding-Registry.
 */

type VaultActionHandlers = {
  handleRescanVault: () => void;
};

export const refreshActiveVault = (actions: VaultActionHandlers) => {
  actions.handleRescanVault();
};
