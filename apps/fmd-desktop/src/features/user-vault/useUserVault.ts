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
import {
  USER_VAULT_SCHEMA_VERSION,
  buildUserVaultProfilePath,
  createEmptyProfileData,
  mergeProfileData,
  resolveUserVaultPath,
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
  listUserVaultProfiles,
  loadProfileData,
  loadUserVaultMeta,
  saveExamRunStore,
  saveFastFlashcardStore,
  saveSpacedRepetitionStore,
  setActiveProfileId,
  type UserVaultProfileSummary,
} from "./storage";

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

  const resolvedPath = useMemo(
    () => resolveUserVaultPath(mode, vaultPath, customPath),
    [customPath, mode, vaultPath],
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, profiles],
  );

  const activeProfilePath = useMemo(() => {
    if (!resolvedPath || !activeProfileId) {
      return null;
    }
    return buildUserVaultProfilePath(resolvedPath, activeProfileId);
  }, [activeProfileId, resolvedPath]);

  const refreshProfiles = useCallback(async () => {
    if (!resolvedPath) {
      setProfiles([]);
      setActiveProfileIdState(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setError("");
    const [nextProfiles, meta] = await Promise.all([
      listUserVaultProfiles(resolvedPath),
      loadUserVaultMeta(resolvedPath),
    ]);
    let nextActive = meta.activeProfileId;
    if (nextActive && !nextProfiles.some((profile) => profile.id === nextActive)) {
      nextActive = null;
    }
    if (!nextActive && nextProfiles.length > 0) {
      nextActive = nextProfiles[0]?.id ?? null;
      if (nextActive) {
        await setActiveProfileId(resolvedPath, nextActive);
      }
    }
    setProfiles(nextProfiles);
    setActiveProfileIdState(nextActive);
    setStatus("idle");
  }, [resolvedPath]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await refreshProfiles();
      } catch (loadError) {
        if (!cancelled) {
          setStatus("error");
          setError(asErrorMessage(loadError, "User vault could not be loaded."));
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
      title: "Select User Vault",
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
        setError(asErrorMessage(loadError, "Profile could not be created."));
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
        setError(asErrorMessage(loadError, "Profile could not be loaded."));
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
          title: "Export User Vault",
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
          title: "Import User Vault",
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
    customPath,
    error,
    handleCreateProfile,
    handleExport,
    handleImport,
    handleModeChange,
    handlePickCustomPath,
    handleSelectProfile,
    isBusy,
    mode,
    profiles,
    refreshProfiles,
    resolvedPath,
    revision,
    status,
  };
};

export type UserVaultState = ReturnType<typeof useUserVault>;
