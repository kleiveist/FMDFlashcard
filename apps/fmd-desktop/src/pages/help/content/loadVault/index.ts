/**
 * @file apps/fmd-desktop/src/pages/help/content/loadVault/index.ts
 *
 * Purpose:
 * - Provides the "Load a vault" guide content for Help.
 */

import { LoadVaultTabData, LoadVaultTabId } from "../types";

import { vaultAndIndexSection } from "./sections/vaultAndIndex";
import { dataAndSyncSection } from "./sections/dataAndSync";

export const LOAD_VAULT_ORDER: LoadVaultTabId[] = ["vault-and-index", "data-and-sync"];

export const LOAD_VAULT_TABS: Record<LoadVaultTabId, LoadVaultTabData> = {
  "vault-and-index": vaultAndIndexSection,
  "data-and-sync": dataAndSyncSection,
};
