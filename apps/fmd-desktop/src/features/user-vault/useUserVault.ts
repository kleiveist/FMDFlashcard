/**
 * @file apps/fmd-desktop/src/features/user-vault/useUserVault.ts
 *
 * Zweck:
 * - Verwaltet User Vault State und Aktionen fuer die UI.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { joinPath } from "../../lib/path";
import {
  USER_VAULT_SCHEMA_VERSION,
  PROFILE_ROOT_DIR,
  resolveActiveProfileRoot,
  createEmptyProfileData,
  mergeProfileData,
  selectProfileFromExport,
  type UserVaultExportPayload,
  type UserVaultImportStrategy,
  type UserVaultMode,
} from "../../lib/userVault";
import {
  createEmptyExamRunStore,
  createEmptyFastFlashcardStore,
  createEmptySpacedRepetitionStore,
  createUserVaultProfile,
  loadProfileData,
  loadUserVaultMeta,
  listUserVaultProfiles,
  migrateLegacyProfileRoot,
  saveExamRunStore,
  saveFastFlashcardStore,
  saveProfileSettings,
  saveSpacedRepetitionStore,
  setActiveProfileId,
  validateProfileRoot,
  type UserVaultProfileSummary,
} from "./storage";

const logUserVaultEvent = (event: string, payload: Record<string, unknown>) => {
  if (typeof console !== "undefined") {
    console.info(`[userVault] ${event}`, payload);
  }
};

type UseUserVaultOptions = {
  vaultPath: string | null;
  mode: UserVaultMode;
  setMode: (value: UserVaultMode) => void;
  customPath: string | null;
  setCustomPath: (value: string | null) => void;
};

type ExportScope = "active" | "all";

const readJsonFile = async (path: string) => {
  const raw = await invoke<string>("read_json_file", { path });
  return JSON.parse(raw) as UserVaultExportPayload;
};

const writeJsonFile = async (path: string, payload: unknown) => {
  const contents = JSON.stringify(payload, null, 2);
  await invoke("write_json_file", { path, contents });
};

const ensureJsonExtension = (path: string) =>
  path.toLowerCase().endsWith(".json") ? path : `${path}.json`;

export const useUserVault = ({
  vaultPath,
  mode,
  setMode,
  customPath,
  setCustomPath,
}: UseUserVaultOptions) => {
  const [profiles, setProfiles] = useState<UserVaultProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [profileRootPath, setProfileRootPath] = useState<string | null>(null);
  const [migrationWarning, setMigrationWarning] = useState<string | null>(null);

  const autoRootPath = useMemo(
    () => (vaultPath ? joinPath(vaultPath, PROFILE_ROOT_DIR) : null),
    [vaultPath],
  );

  const customRootPath = useMemo(() => customPath?.trim() ?? null, [customPath]);

  const resolvedPath = profileRootPath;

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, profiles],
  );

  const activeProfilePath = useMemo(
    () => activeProfile?.path ?? null,
    [activeProfile],
  );

  const refreshProfiles = useCallback(async () => {
    setStatus("loading");
    setError("");

    if (vaultPath) {
      const migration = await migrateLegacyProfileRoot(vaultPath);
      if (migration.conflict) {
        setMigrationWarning(
          "Both /user and /profile exist in this vault. Choose which profile root to use.",
        );
      } else if (migration.error) {
        setMigrationWarning(migration.error);
      } else {
        setMigrationWarning(null);
      }
      if (migration.moved) {
        logUserVaultEvent("profile.migrated", {
          vaultPath,
        });
      }
    } else {
      setMigrationWarning(null);
    }
    const resolvedRoot = resolveActiveProfileRoot(
      mode,
      vaultPath,
      customRootPath,
    );
    if (!resolvedRoot) {
      const reason =
        mode === "custom"
          ? "Custom path is required."
          : "Select a vault to enable Auto profile root.";
      setStatus("error");
      setError(reason);
      setProfiles([]);
      setActiveProfileIdState(null);
      setProfileRootPath(null);
      logUserVaultEvent("profile.resolve_failed", {
        mode,
        reason,
        autoRootPath,
        customRootPath,
      });
      return;
    }

    const validation = await validateProfileRoot(resolvedRoot);
    if (!validation.ok) {
      setStatus("error");
      setError(validation.reason);
      setProfiles([]);
      setActiveProfileIdState(null);
      setProfileRootPath(null);
      logUserVaultEvent("profile.validation_failed", {
        mode,
        profileRoot: resolvedRoot,
        reason: validation.reason,
      });
      return;
    }

    setProfileRootPath(resolvedRoot);

    let nextProfiles = await listUserVaultProfiles(resolvedRoot);
    if (nextProfiles.length === 0) {
      try {
        const created = await createUserVaultProfile(resolvedRoot, "default");
        nextProfiles = [created];
        logUserVaultEvent("profile.auto_created", {
          profileRoot: resolvedRoot,
          id: created.id,
        });
      } catch (createError) {
        setStatus("error");
        setError(asErrorMessage(createError, "No users found in the profile root."));
        setProfiles([]);
        setActiveProfileIdState(null);
        setProfileRootPath(resolvedRoot);
        logUserVaultEvent("profile.create_failed", {
          profileRoot: resolvedRoot,
          reason: asErrorMessage(createError, "Failed to create profile."),
        });
        return;
      }
    }
    const meta = await loadUserVaultMeta(resolvedRoot);
    let nextActive = meta.activeProfileId;
    if (nextActive && !nextProfiles.some((profile) => profile.id === nextActive)) {
      nextActive = null;
    }
    if (!nextActive && nextProfiles.length > 0) {
      nextActive = nextProfiles[0]?.id ?? null;
      if (nextActive) {
        await setActiveProfileId(resolvedRoot, nextActive);
      }
    }
    setProfiles(nextProfiles);
    setActiveProfileIdState(nextActive);
    if (nextProfiles.length === 0) {
      setError("No users found in the selected profile root.");
    }
    setStatus("idle");
    logUserVaultEvent("profile.loaded", {
      mode,
      profileRoot: resolvedRoot,
      users: nextProfiles.length,
      activeUserId: nextActive,
    });
  }, [autoRootPath, customRootPath, mode, vaultPath]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await refreshProfiles();
      } catch (loadError) {
        if (!cancelled) {
          setStatus("error");
          setError(asErrorMessage(loadError, "Profile root could not be loaded."));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshProfiles]);

  const handleModeChange = useCallback(
    (value: UserVaultMode) => {
      setMode(value);
    },
    [setMode],
  );

  const handlePickCustomPath = useCallback(async () => {
    const selected = await open({
      title: "Select Profile Root",
      directory: true,
      multiple: false,
    });
    if (typeof selected === "string") {
      setCustomPath(selected);
    }
  }, [setCustomPath]);

  const handleCreateProfile = useCallback(
    async (name: string) => {
      if (!resolvedPath) {
        return;
      }
      setIsBusy(true);
      setError("");
      try {
        const profile = await createUserVaultProfile(resolvedPath, name);
        await setActiveProfileId(resolvedPath, profile.id);
        setActiveProfileIdState(profile.id);
        setProfiles((prev) => {
          const next = [...prev.filter((item) => item.id !== profile.id), profile];
          return next.sort((a, b) => a.id.localeCompare(b.id));
        });
      } catch (loadError) {
        setError(asErrorMessage(loadError, "User could not be created."));
      } finally {
        setIsBusy(false);
      }
    },
    [resolvedPath],
  );

  const handleSelectProfile = useCallback(
    async (profileId: string) => {
      if (!resolvedPath) {
        return;
      }
      setIsBusy(true);
      setError("");
      try {
        await setActiveProfileId(resolvedPath, profileId);
        setActiveProfileIdState(profileId);
      } catch (loadError) {
        setError(asErrorMessage(loadError, "User could not be loaded."));
      } finally {
        setIsBusy(false);
      }
    },
    [resolvedPath],
  );

  const handleExport = useCallback(
    async (scope: ExportScope) => {
      if (!resolvedPath) {
        return;
      }
      setIsBusy(true);
      setError("");
      try {
        const targetPath = await save({
          title: "Export User",
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!targetPath) {
          return;
        }
        const resolvedTarget = ensureJsonExtension(targetPath);
        if (scope === "active") {
          if (!activeProfile) {
            throw new Error("No active profile selected.");
          }
          const data = await loadProfileData(activeProfile.path);
          const payload: UserVaultExportPayload = {
            schemaVersion: USER_VAULT_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            profile: {
              id: activeProfile.id,
              name: activeProfile.name,
              createdAt: activeProfile.createdAt,
            },
            data,
          };
          await writeJsonFile(resolvedTarget, payload);
          return;
        }
        const entries = await Promise.all(
          profiles.map(async (profile) => ({
            profile: {
              id: profile.id,
              name: profile.name,
              createdAt: profile.createdAt,
            },
            data: await loadProfileData(profile.path),
          })),
        );
        const payload: UserVaultExportPayload = {
          schemaVersion: USER_VAULT_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          profiles: entries,
        };
        await writeJsonFile(resolvedTarget, payload);
      } catch (loadError) {
        setError(asErrorMessage(loadError, "Export failed."));
      } finally {
        setIsBusy(false);
      }
    },
    [activeProfile, profiles, resolvedPath],
  );

  const handleImport = useCallback(
    async (strategy: UserVaultImportStrategy) => {
      if (!activeProfilePath || !activeProfile) {
        return;
      }
      setIsBusy(true);
      setError("");
      try {
        const selected = await open({
          title: "Import User",
          filters: [{ name: "JSON", extensions: ["json"] }],
          multiple: false,
        });
        if (!selected || typeof selected !== "string") {
          return;
        }
        const payload = await readJsonFile(selected);
        const selectedEntry = selectProfileFromExport(payload, activeProfile.id);
        if (!selectedEntry) {
          throw new Error("No profile data found in import.");
        }
        const current = await loadProfileData(activeProfilePath);
        const incoming = selectedEntry.data ?? createEmptyProfileData();
        const merged = mergeProfileData(current, incoming, strategy);
        await saveSpacedRepetitionStore(activeProfilePath, {
          ...createEmptySpacedRepetitionStore(),
          byVaultId: merged.spacedRepetitionByVaultId,
          migratedVaultIds: Object.keys(merged.spacedRepetitionByVaultId),
        });
        await saveFastFlashcardStore(activeProfilePath, {
          ...createEmptyFastFlashcardStore(),
          sessions: merged.fastFlashcardSessions,
          migratedFromAppData: true,
        });
        await saveExamRunStore(activeProfilePath, {
          ...createEmptyExamRunStore(),
          runs: merged.examRuns,
          migratedFromAppData: true,
        });
        await saveProfileSettings(activeProfilePath, merged.settings ?? null);
        setRevision((value) => value + 1);
      } catch (loadError) {
        setError(asErrorMessage(loadError, "Import failed."));
      } finally {
        setIsBusy(false);
      }
    },
    [activeProfile, activeProfilePath],
  );

  return {
    activeProfile,
    activeProfileId,
    activeProfilePath,
    autoRootPath,
    customPath,
    customRootPath,
    error,
    handleCreateProfile,
    handleExport,
    handleImport,
    handleModeChange,
    handlePickCustomPath,
    handleSelectProfile,
    isBusy,
    migrationWarning,
    mode,
    profiles,
    profileRootPath,
    refreshProfiles,
    resolvedPath,
    revision,
    status,
  };
};

export type UserVaultState = ReturnType<typeof useUserVault>;
