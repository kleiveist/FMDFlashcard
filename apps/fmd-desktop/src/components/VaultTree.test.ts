/**
 * @file apps/fmd-desktop/src/components/VaultTree.test.ts
 *
 * Zweck:
 * - Tests fuer VaultTree Hilfsfunktionen.
 */

import { describe, expect, it, vi } from "vitest";
import {
  buildVaultDeleteHandlers,
  shouldHandleVaultDeleteShortcut,
} from "./VaultTree";
import { type VaultFile } from "../lib/tree";

describe("buildVaultDeleteHandlers", () => {
  const target: VaultFile = {
    path: "/vault/Note.md",
    relative_path: "Note.md",
  };

  it("confirms deletion and triggers rescan", async () => {
    const invokeDelete = vi.fn().mockResolvedValue(undefined);
    const onRescanVault = vi.fn();
    const onClose = vi.fn();
    const onClearSelection = vi.fn();
    const setError = vi.fn();
    const setIsDeleting = vi.fn();

    const { handleConfirm } = buildVaultDeleteHandlers({
      vaultPath: "/vault",
      deleteTarget: target,
      selectedFile: target,
      isDeleting: false,
      invokeDelete,
      onRescanVault,
      onClose,
      onClearSelection,
      setError,
      setIsDeleting,
    });

    await handleConfirm();

    expect(invokeDelete).toHaveBeenCalledWith("/vault", "Note.md");
    expect(onRescanVault).toHaveBeenCalled();
    expect(onClearSelection).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels without deleting or rescanning", () => {
    const invokeDelete = vi.fn();
    const onRescanVault = vi.fn();
    const onClose = vi.fn();
    const onClearSelection = vi.fn();
    const setError = vi.fn();
    const setIsDeleting = vi.fn();

    const { handleCancel } = buildVaultDeleteHandlers({
      vaultPath: "/vault",
      deleteTarget: target,
      selectedFile: null,
      isDeleting: false,
      invokeDelete,
      onRescanVault,
      onClose,
      onClearSelection,
      setError,
      setIsDeleting,
    });

    handleCancel();

    expect(invokeDelete).not.toHaveBeenCalled();
    expect(onRescanVault).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("shouldHandleVaultDeleteShortcut", () => {
  it("returns true when Delete is pressed inside the vault tree", () => {
    const insideTarget = {};
    const currentTarget = {
      contains: (node: unknown) => node === insideTarget,
    };

    expect(
      shouldHandleVaultDeleteShortcut({
        key: "Delete",
        currentTarget,
        target: insideTarget,
      }),
    ).toBe(true);
  });

  it("returns false when target is outside or key is different", () => {
    const insideTarget = {};
    const currentTarget = {
      contains: (node: unknown) => node === insideTarget,
    };

    expect(
      shouldHandleVaultDeleteShortcut({
        key: "Backspace",
        currentTarget,
        target: insideTarget,
      }),
    ).toBe(false);

    expect(
      shouldHandleVaultDeleteShortcut({
        key: "Delete",
        currentTarget,
        target: {},
      }),
    ).toBe(false);
  });
});
