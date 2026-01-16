/**
 * @file apps/fmd-desktop/src/actions/vaultActions.ts
 *
 * Zweck:
 * - Uebernimmt Vault-bezogene Aktionen fuer die Keybinding-Registry.
 */

type VaultActionHandlers = {
  handleRescanVault: () => Promise<boolean>;
};

export const refreshActiveVault = (actions: VaultActionHandlers) => {
  return actions.handleRescanVault();
};
