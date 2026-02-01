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
import { joinPath, normalizeVaultPath, vaultBaseName } from "../../lib/path";
import {
  USER_VAULT_SCHEMA_VERSION,
  buildUserVaultProfilePath,
  createEmptyProfileData,
  mergeProfileData,
  selectProfileFromExport,
  type UserVaultExportPayload,
  type UserVaultImportStrategy,
  type UserVaultMode,
} from "../../lib/userVault";
import {
  resolveActiveUser,
  sortUserVaultCandidates,
  type UserVaultCandidate,
} from "../../lib/userVaultUsers";
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
  saveProfileSettings,
  saveSpacedRepetitionStore,
  setActiveProfileId,
  scanUsersInRoot,
  validateUserDir,
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
  selectedAutoPath: string | null;
  setSelectedAutoPath: (value: string | null) => void;
  selectedCustomPath: string | null;
  setSelectedCustomPath: (value: string | null) => void;
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
  selectedAutoPath,
  setSelectedAutoPath,
  selectedCustomPath,
  setSelectedCustomPath,
}: UseUserVaultOptions) => {
  const [profiles, setProfiles] = useState<UserVaultProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [autoUsers, setAutoUsers] = useState<UserVaultCandidate[]>([]);
  const [customUsers, setCustomUsers] = useState<UserVaultCandidate[]>([]);
  const [activeUserPath, setActiveUserPath] = useState<string | null>(null);

  const autoRootPath = useMemo(
    () => (vaultPath ? joinPath(vaultPath, "user") : null),
    [vaultPath],
  );

  const customRootPath = useMemo(() => customPath?.trim() ?? null, [customPath]);

  const resolvedPath = activeUserPath;

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
    setStatus("loading");
    setError("");

    const [autoScan, customScan] = await Promise.all([
      autoRootPath
        ? scanUsersInRoot(autoRootPath, "auto")
        : Promise.resolve({ users: [], error: "Select a vault to use Auto users." }),
      customRootPath
        ? scanUsersInRoot(customRootPath, "custom")
        : Promise.resolve({ users: [], error: "Custom path is required." }),
    ]);

    let nextAutoUsers = autoScan.users;
    let nextAutoError = autoScan.error;
    if (
      autoRootPath &&
      nextAutoUsers.length === 0 &&
      (!autoScan.error || autoScan.error === "User root path does not exist.")
    ) {
      const fallbackUser: UserVaultCandidate = {
        id: normalizeVaultPath(autoRootPath) || autoRootPath,
        name: vaultBaseName(autoRootPath),
        path: autoRootPath,
        source: "auto",
      };
      nextAutoUsers = sortUserVaultCandidates([fallbackUser]);
      nextAutoError = null;
    }

    setAutoUsers(nextAutoUsers);
    setCustomUsers(customScan.users);

    const resolution = resolveActiveUser({
      source: mode,
      autoUsers: nextAutoUsers,
      customUsers: customScan.users,
      selectedAutoPath,
      selectedCustomPath,
      autoError:
        mode === "auto"
          ? autoRootPath
            ? nextAutoError
            : "Select a vault to use Auto users."
          : null,
      customError:
        mode === "custom"
          ? customRootPath
            ? customScan.error
            : "Custom path is required."
          : null,
    });

    const selectedPath = mode === "custom" ? selectedCustomPath : selectedAutoPath;
    logUserVaultEvent("users.resolve", {
      source: mode,
      autoCount: nextAutoUsers.length,
      customCount: customScan.users.length,
      selectedPath,
      activePath: resolution.activeUser?.path ?? null,
      reason: resolution.reason,
      autoRootPath,
      customRootPath,
    });

    if (!resolution.activeUser) {
      setStatus("error");
      setError(resolution.error);
      setProfiles([]);
      setActiveProfileIdState(null);
      setActiveUserPath(null);
      return;
    }

    setActiveUserPath(resolution.activeUser.path);

    const isAutoRootFallback =
      mode === "auto" &&
      autoRootPath &&
      autoScan.users.length === 0 &&
      resolution.activeUser.path === autoRootPath;

    if (isAutoRootFallback) {
      setProfiles([]);
      setActiveProfileIdState(null);
      setStatus("idle");
      logUserVaultEvent("users.empty_auto_root", {
        path: resolution.activeUser.path,
        source: mode,
      });
      return;
    }

    const validation = await validateUserDir(resolution.activeUser.path);
    if (!validation.ok) {
      setStatus("error");
      setError(validation.reason);
      setProfiles([]);
      setActiveProfileIdState(null);
      logUserVaultEvent("users.validation_failed", {
        path: resolution.activeUser.path,
        source: mode,
        reason: validation.reason,
      });
      return;
    }

    const [nextProfiles, meta] = await Promise.all([
      listUserVaultProfiles(resolution.activeUser.path),
      loadUserVaultMeta(resolution.activeUser.path),
    ]);
    let nextActive = meta.activeProfileId;
    if (nextActive && !nextProfiles.some((profile) => profile.id === nextActive)) {
      nextActive = null;
    }
    if (!nextActive && nextProfiles.length > 0) {
      nextActive = nextProfiles[0]?.id ?? null;
      if (nextActive) {
        await setActiveProfileId(resolution.activeUser.path, nextActive);
      }
    }
    setProfiles(nextProfiles);
    setActiveProfileIdState(nextActive);
    setStatus("idle");
    logUserVaultEvent("users.loaded", {
      path: resolution.activeUser.path,
      source: mode,
      profiles: nextProfiles.length,
    });
  }, [
    autoRootPath,
    customRootPath,
    mode,
    selectedAutoPath,
    selectedCustomPath,
  ]);

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

  const handleSelectAutoUser = useCallback(
    (value: string) => {
      setSelectedAutoPath(value);
    },
    [setSelectedAutoPath],
  );

  const handleSelectCustomUser = useCallback(
    (value: string) => {
      setSelectedCustomPath(value);
    },
    [setSelectedCustomPath],
  );

  const handlePickCustomPath = useCallback(async () => {
    const selected = await open({
      title: "Select User Vault",
      directory: true,
      multiple: false,
    });
    if (typeof selected === "string") {
      setCustomPath(selected);
      setSelectedCustomPath(null);
    }
  }, [setCustomPath, setSelectedCustomPath]);

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
    activeUserPath,
    activeProfile,
    activeProfileId,
    activeProfilePath,
    autoRootPath,
    autoUsers,
    customPath,
    customRootPath,
    customUsers,
    error,
    handleCreateProfile,
    handleExport,
    handleImport,
    handleModeChange,
    handlePickCustomPath,
    handleSelectAutoUser,
    handleSelectCustomUser,
    handleSelectProfile,
    isBusy,
    mode,
    profiles,
    refreshProfiles,
    resolvedPath,
    revision,
    selectedAutoPath,
    selectedCustomPath,
    status,
  };
};

export type UserVaultState = ReturnType<typeof useUserVault>;
