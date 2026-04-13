/**
 * @file apps/fmd-desktop/src/features/user-vault/useUserVault.ts
 *
 * Zweck:
 * - Verwaltet User Vault State und Aktionen fuer die UI.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { joinPath } from "../../lib/path";
import {
  USER_VAULT_SCHEMA_VERSION,
  PROFILE_ROOT_DIR,
  resolveActiveProfileRoot,
  resolveCustomProfileRootPath,
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
  ensureProfileRoot,
  getOsUsername,
  loadProfileData,
  loadUserVaultMeta,
  listUserVaultProfiles,
  migrateDefaultProfileFolders,
  migrateLegacyProfileRoot,
  saveExamRunStore,
  saveFastFlashcardStore,
  saveProfileSettings,
  saveSpacedRepetitionStore,
  setActiveProfileId,
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

type BootstrapOverrides = {
  mode?: UserVaultMode;
  vaultPath?: string | null;
  customPath?: string | null;
};

type BootstrapResult = {
  ok: boolean;
  resolvedRoot: string | null;
  activeProfileId: string | null;
  reason: string;
};

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

const resolveCustomPath = (value: string | null | undefined) => {
  return resolveCustomProfileRootPath(value ?? null);
};

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
  const bootstrapRequestIdRef = useRef(0);
  const bootstrapInFlightRef = useRef<{
    key: string;
    promise: Promise<BootstrapResult>;
  } | null>(null);

  const autoRootPath = useMemo(
    () => (vaultPath ? joinPath(vaultPath, PROFILE_ROOT_DIR) : null),
    [vaultPath],
  );

  const customRootPath = useMemo(() => resolveCustomPath(customPath), [customPath]);

  const resolvedPath = profileRootPath;

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, profiles],
  );

  const activeProfilePath = useMemo(
    () => activeProfile?.path ?? null,
    [activeProfile],
  );

  const bootstrapProfileContext = useCallback(
    async (
      reason: string,
      overrides: BootstrapOverrides = {},
    ): Promise<BootstrapResult> => {
      const effectiveMode = overrides.mode ?? mode;
      const effectiveVaultPath =
        overrides.vaultPath !== undefined ? overrides.vaultPath : vaultPath;
      const effectiveCustomRoot =
        overrides.customPath !== undefined
          ? resolveCustomPath(overrides.customPath)
          : customRootPath;
      const bootstrapKey = [
        effectiveMode,
        effectiveVaultPath ?? "",
        effectiveCustomRoot ?? "",
      ].join("|");
      const inFlight = bootstrapInFlightRef.current;
      if (inFlight && inFlight.key === bootstrapKey) {
        return inFlight.promise;
      }

      const run = (async (): Promise<BootstrapResult> => {
        const requestId = ++bootstrapRequestIdRef.current;

        setStatus("loading");
        setError("");

        let nextMigrationWarning: string | null = null;

        if (effectiveVaultPath) {
          const migration = await migrateLegacyProfileRoot(effectiveVaultPath);
          if (migration.conflict) {
            nextMigrationWarning =
              "Both /user and /profile exist in this vault. Choose which profile root to use.";
          } else if (migration.error) {
            nextMigrationWarning = migration.error;
          }
          if (migration.moved) {
            logUserVaultEvent("profile.migrated", {
              vaultPath: effectiveVaultPath,
              reason,
            });
          }
        }

        const commit = (next: {
          status: "idle" | "loading" | "error";
          error: string;
          profileRootPath: string | null;
          profiles: UserVaultProfileSummary[];
          activeProfileId: string | null;
        }) => {
          if (bootstrapRequestIdRef.current !== requestId) {
            return;
          }
          setMigrationWarning(nextMigrationWarning);
          setProfileRootPath(next.profileRootPath);
          setProfiles(next.profiles);
          setActiveProfileIdState(next.activeProfileId);
          setError(next.error);
          setStatus(next.status);
        };

        if (effectiveMode === "auto" && !effectiveVaultPath) {
          commit({
            status: "idle",
            error: "",
            profileRootPath: null,
            profiles: [],
            activeProfileId: null,
          });
          logUserVaultEvent("profile.vault_missing", {
            reason,
            mode: effectiveMode,
          });
          return {
            ok: false,
            resolvedRoot: null,
            activeProfileId: null,
            reason: "No active vault selected.",
          };
        }

        const resolvedRoot = resolveActiveProfileRoot(
          effectiveMode,
          effectiveVaultPath,
          effectiveCustomRoot,
        );

        if (!resolvedRoot) {
          const message =
            effectiveMode === "custom"
              ? "Custom path is required."
              : "Select a vault to enable Auto profile root.";
          commit({
            status: "error",
            error: message,
            profileRootPath: null,
            profiles: [],
            activeProfileId: null,
          });
          logUserVaultEvent("profile.resolve_failed", {
            reason,
            mode: effectiveMode,
            autoRootPath,
            customRootPath: effectiveCustomRoot,
          });
          return {
            ok: false,
            resolvedRoot: null,
            activeProfileId: null,
            reason: message,
          };
        }

        const ensured = await ensureProfileRoot(resolvedRoot);
        if (!ensured.ok) {
          commit({
            status: "error",
            error: ensured.reason,
            profileRootPath: resolvedRoot,
            profiles: [],
            activeProfileId: null,
          });
          logUserVaultEvent("profile.ensure_failed", {
            reason,
            mode: effectiveMode,
            profileRoot: resolvedRoot,
            ensureReason: ensured.reason,
          });
          return {
            ok: false,
            resolvedRoot,
            activeProfileId: null,
            reason: ensured.reason,
          };
        }

        try {
          await migrateDefaultProfileFolders(resolvedRoot);
          const [listedProfiles, meta] = await Promise.all([
            listUserVaultProfiles(resolvedRoot),
            loadUserVaultMeta(resolvedRoot),
          ]);
          let nextProfiles = listedProfiles;
          if (nextProfiles.length === 0) {
            try {
              const osUsername = await getOsUsername();
              const profileName = osUsername.trim() || "user";
              const created = await createUserVaultProfile(
                resolvedRoot,
                profileName.toLowerCase(),
              );
              nextProfiles = [created];
              logUserVaultEvent("profile.auto_created", {
                reason,
                mode: effectiveMode,
                profileRoot: resolvedRoot,
                id: created.id,
              });
            } catch (createError) {
              const message = asErrorMessage(
                createError,
                "Profile could not be created.",
              );
              commit({
                status: "error",
                error: message,
                profileRootPath: resolvedRoot,
                profiles: [],
                activeProfileId: null,
              });
              logUserVaultEvent("profile.create_failed", {
                reason,
                mode: effectiveMode,
                profileRoot: resolvedRoot,
                error: message,
              });
              return {
                ok: false,
                resolvedRoot,
                activeProfileId: null,
                reason: message,
              };
            }
          }
          let nextActive = meta.activeProfileId;

          if (nextActive && !nextProfiles.some((profile) => profile.id === nextActive)) {
            nextActive = null;
          }

          if (!nextActive && nextProfiles.length > 0) {
            nextActive = nextProfiles[0]?.id ?? null;
          }

          if (nextActive !== meta.activeProfileId) {
            await setActiveProfileId(resolvedRoot, nextActive);
          }

          commit({
            status: "idle",
            error: "",
            profileRootPath: resolvedRoot,
            profiles: nextProfiles,
            activeProfileId: nextActive,
          });

          logUserVaultEvent("profile.loaded", {
            reason,
            mode: effectiveMode,
            profileRoot: resolvedRoot,
            users: nextProfiles.length,
            activeUserId: nextActive,
          });

          return {
            ok: true,
            resolvedRoot,
            activeProfileId: nextActive,
            reason: "ok",
          };
        } catch (loadError) {
          const message = asErrorMessage(loadError, "Profile root could not be loaded.");
          commit({
            status: "error",
            error: message,
            profileRootPath: resolvedRoot,
            profiles: [],
            activeProfileId: null,
          });
          logUserVaultEvent("profile.load_failed", {
            reason,
            mode: effectiveMode,
            profileRoot: resolvedRoot,
            error: message,
          });
          return {
            ok: false,
            resolvedRoot,
            activeProfileId: null,
            reason: message,
          };
        }
      })();

      bootstrapInFlightRef.current = { key: bootstrapKey, promise: run };
      try {
        return await run;
      } finally {
        if (bootstrapInFlightRef.current?.promise === run) {
          bootstrapInFlightRef.current = null;
        }
      }
    },
    [autoRootPath, customRootPath, mode, vaultPath],
  );

  const refreshProfiles = useCallback(async () => {
    await bootstrapProfileContext("refreshProfiles");
  }, [bootstrapProfileContext]);

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const handleModeChange = useCallback(
    (value: UserVaultMode) => {
      if (value === mode) {
        return;
      }
      setMode(value);
      void bootstrapProfileContext("sourceChanged", { mode: value });
    },
    [bootstrapProfileContext, mode, setMode],
  );

  const handleCustomPathChange = useCallback(
    (value: string | null) => {
      const normalized = resolveCustomPath(value);
      if ((customRootPath ?? null) === (normalized ?? null)) {
        return;
      }
      setCustomPath(normalized);
      void bootstrapProfileContext("customPathChanged", {
        customPath: normalized,
      });
    },
    [bootstrapProfileContext, customRootPath, setCustomPath],
  );

  const handlePickCustomPath = useCallback(async () => {
    const selected = await open({
      title: "Select Profile Root",
      directory: true,
      multiple: false,
    });
    if (typeof selected === "string") {
      handleCustomPathChange(selected);
    }
  }, [handleCustomPathChange]);

  const handleCreateProfile = useCallback(
    async (name: string) => {
      setIsBusy(true);
      setError("");
      try {
        const bootstrapped = await bootstrapProfileContext(
          "beforeUserAction:createProfile",
        );
        if (!bootstrapped.ok || !bootstrapped.resolvedRoot) {
          return;
        }
        const profile = await createUserVaultProfile(bootstrapped.resolvedRoot, name);
        await setActiveProfileId(bootstrapped.resolvedRoot, profile.id);
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
    [bootstrapProfileContext],
  );

  const handleSelectProfile = useCallback(
    async (profileId: string) => {
      setIsBusy(true);
      setError("");
      try {
        const bootstrapped = await bootstrapProfileContext(
          "beforeUserAction:selectProfile",
        );
        if (!bootstrapped.ok || !bootstrapped.resolvedRoot) {
          return;
        }
        await setActiveProfileId(bootstrapped.resolvedRoot, profileId);
        setActiveProfileIdState(profileId);
      } catch (loadError) {
        setError(asErrorMessage(loadError, "User could not be loaded."));
      } finally {
        setIsBusy(false);
      }
    },
    [bootstrapProfileContext],
  );

  const handleExport = useCallback(
    async (scope: ExportScope) => {
      setIsBusy(true);
      setError("");
      try {
        const bootstrapped = await bootstrapProfileContext("beforeUserAction:export");
        if (!bootstrapped.ok || !bootstrapped.resolvedRoot) {
          return;
        }
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
    [activeProfile, bootstrapProfileContext, profiles],
  );

  const handleImport = useCallback(
    async (strategy: UserVaultImportStrategy) => {
      setIsBusy(true);
      setError("");
      try {
        const bootstrapped = await bootstrapProfileContext("beforeUserAction:import");
        if (!bootstrapped.ok) {
          return;
        }
        if (!activeProfilePath || !activeProfile) {
          return;
        }
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
    [activeProfile, activeProfilePath, bootstrapProfileContext],
  );

  return {
    activeProfile,
    activeProfileId,
    activeProfilePath,
    autoRootPath,
    bootstrapProfileContext,
    customPath,
    customRootPath,
    error,
    handleCreateProfile,
    handleCustomPathChange,
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
