/**
 * @file apps/fmd-desktop/src/actions/vaultActions.ts
 *
 * Zweck:
 * - Uebernimmt Vault-bezogene Aktionen fuer die Keybinding-Registry.
 */

type VaultActionHandlers = {
  handleRescanVault: (source?: string) => Promise<boolean>;
};

export const refreshActiveVault = async (actions: VaultActionHandlers, source = "unknown") => {
  if (import.meta.env.DEV) {
    console.info("[vault] Refresh trigger received", { source });
  }
  try {
    const success = await actions.handleRescanVault(source);
    if (!success && import.meta.env.DEV) {
      console.warn("[vault] Refresh request failed", { source });
    }
    return success;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[vault] Refresh crashed", { source, error });
    }
    return false;
  }
};
