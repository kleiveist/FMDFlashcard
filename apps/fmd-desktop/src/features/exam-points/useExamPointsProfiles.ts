/**
 * @file apps/fmd-desktop/src/features/exam-points/useExamPointsProfiles.ts
 *
 * Zweck:
 * - Verwaltet Points-Profile pro User-Profil.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EXAM_POINTS_DEFAULT_PROFILE_NAME,
  buildExamPointsProfile,
  createEmptyExamPointsProfilesStore,
  getExamPointsProfileByName,
  isExamPointsProfileNameTaken,
  normalizeExamPointsProfile,
  normalizeExamPointsProfilesStore,
  type ExamPointsProfile,
  type ExamPointsProfilesStore,
} from "../../lib/exam/pointsProfiles";
import { loadExamPointsProfileStore, saveExamPointsProfileStore } from "../user-vault/storage";

type LegacyPointsDefaults = {
  durationMinutes: number;
  maxTotalPoints: number;
  taskCount: number;
  taskPoints: number[];
};

type UseExamPointsProfilesOptions = {
  profilePath: string | null;
  profileRevision: number;
  legacyDefaults: LegacyPointsDefaults;
};

type PointsProfileMutationResult = {
  ok: boolean;
  error: string | null;
  profile?: ExamPointsProfile;
};

const buildProfileId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `points-${crypto.randomUUID()}`;
  }
  return `points-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createLegacyDefaultProfile = (legacyDefaults: LegacyPointsDefaults) =>
  buildExamPointsProfile({
    id: buildProfileId(),
    name: EXAM_POINTS_DEFAULT_PROFILE_NAME,
    distribution: "task-order",
    durationMinutes: legacyDefaults.durationMinutes,
    maxTotalPoints: legacyDefaults.maxTotalPoints,
    taskCount: legacyDefaults.taskCount,
    taskPoints: legacyDefaults.taskPoints,
  });

const normalizeStoreWithFallback = (
  store: ExamPointsProfilesStore,
  legacyDefaults: LegacyPointsDefaults,
): ExamPointsProfilesStore => {
  const normalized = normalizeExamPointsProfilesStore(store);
  if (normalized.profiles.length > 0) {
    return normalized;
  }
  const fallbackProfile = createLegacyDefaultProfile(legacyDefaults);
  return {
    schemaVersion: normalized.schemaVersion,
    defaultProfileId: fallbackProfile.id,
    profiles: [fallbackProfile],
  };
};

const touchProfile = (
  profile: ExamPointsProfile,
  updates: Partial<ExamPointsProfile>,
): ExamPointsProfile => {
  const now = new Date().toISOString();
  return normalizeExamPointsProfile({
    ...profile,
    ...updates,
    updatedAt: now,
    version: Math.max(1, (profile.version ?? 1) + 1),
  });
};

export const useExamPointsProfiles = ({
  profilePath,
  profileRevision,
  legacyDefaults,
}: UseExamPointsProfilesOptions) => {
  const [store, setStore] = useState<ExamPointsProfilesStore>(() =>
    normalizeStoreWithFallback(createEmptyExamPointsProfilesStore(), legacyDefaults),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const storeRef = useRef(store);
  const pendingSavePathRef = useRef<string | null>(null);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const persistStore = useCallback(
    async (nextStore: ExamPointsProfilesStore) => {
      const normalized = normalizeExamPointsProfilesStore(nextStore);
      storeRef.current = normalized;
      setStore(normalized);
      if (!profilePath) {
        return true;
      }
      if (pendingSavePathRef.current && pendingSavePathRef.current !== profilePath) {
        return false;
      }
      pendingSavePathRef.current = profilePath;
      setSaving(true);
      try {
        await saveExamPointsProfileStore(profilePath, normalized);
        return true;
      } finally {
        setSaving(false);
        if (pendingSavePathRef.current === profilePath) {
          pendingSavePathRef.current = null;
        }
      }
    },
    [profilePath],
  );

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    const load = async () => {
      try {
        if (!profilePath) {
          const localStore = normalizeStoreWithFallback(
            createEmptyExamPointsProfilesStore(),
            legacyDefaults,
          );
          if (cancelled) {
            return;
          }
          storeRef.current = localStore;
          setStore(localStore);
          setSelectedProfileId(localStore.defaultProfileId);
          return;
        }
        const loaded = await loadExamPointsProfileStore(profilePath);
        let next = normalizeStoreWithFallback(loaded, legacyDefaults);
        const needsWrite =
          loaded.profiles.length !== next.profiles.length ||
          loaded.defaultProfileId !== next.defaultProfileId;
        if (needsWrite) {
          await saveExamPointsProfileStore(profilePath, next);
        }
        if (cancelled) {
          return;
        }
        storeRef.current = next;
        setStore(next);
        setSelectedProfileId((prev) =>
          prev && next.profiles.some((profile) => profile.id === prev)
            ? prev
            : next.defaultProfileId,
        );
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Points profiles could not be loaded.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [legacyDefaults, profilePath, profileRevision]);

  useEffect(() => {
    const current = storeRef.current;
    if (
      !selectedProfileId ||
      !current.profiles.some((profile) => profile.id === selectedProfileId)
    ) {
      setSelectedProfileId(current.defaultProfileId);
    }
  }, [selectedProfileId, store]);

  const profiles = store.profiles;
  const defaultProfile = useMemo(
    () => profiles.find((profile) => profile.id === store.defaultProfileId) ?? profiles[0] ?? null,
    [profiles, store.defaultProfileId],
  );
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? defaultProfile ?? null,
    [defaultProfile, profiles, selectedProfileId],
  );

  const resolveProfileByName = useCallback(
    (name: string | null | undefined) =>
      getExamPointsProfileByName(storeRef.current.profiles, name),
    [],
  );

  const resolveAssignedProfile = useCallback(
    (name: string | null | undefined) => {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return {
          requestedName: null,
          profile: defaultProfile,
          missing: false,
        };
      }
      const profile = resolveProfileByName(trimmed);
      return {
        requestedName: trimmed,
        profile,
        missing: !profile,
      };
    },
    [defaultProfile, resolveProfileByName],
  );

  const createProfile = useCallback(
    async (
      name: string,
      options?: { seedFromProfileId?: string | null },
    ): Promise<PointsProfileMutationResult> => {
      const nextName = name.trim();
      if (!nextName) {
        return { ok: false, error: "Profile name is required." };
      }
      const current = storeRef.current;
      if (isExamPointsProfileNameTaken(current.profiles, nextName)) {
        return { ok: false, error: "Profile name already exists." };
      }
      const seed =
        (options?.seedFromProfileId
          ? current.profiles.find((profile) => profile.id === options.seedFromProfileId)
          : null) ??
        current.profiles.find((profile) => profile.id === current.defaultProfileId) ??
        current.profiles[0] ??
        createLegacyDefaultProfile(legacyDefaults);
      const now = new Date().toISOString();
      const created = normalizeExamPointsProfile({
        ...seed,
        id: buildProfileId(),
        name: nextName,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
      const nextStore: ExamPointsProfilesStore = {
        ...current,
        profiles: [...current.profiles, created],
        defaultProfileId: current.defaultProfileId ?? created.id,
      };
      await persistStore(nextStore);
      setSelectedProfileId(created.id);
      return { ok: true, error: null, profile: created };
    },
    [legacyDefaults, persistStore],
  );

  const renameProfile = useCallback(
    async (profileId: string, nextNameRaw: string): Promise<PointsProfileMutationResult> => {
      const nextName = nextNameRaw.trim();
      if (!nextName) {
        return { ok: false, error: "Profile name is required." };
      }
      const current = storeRef.current;
      const profile = current.profiles.find((entry) => entry.id === profileId);
      if (!profile) {
        return { ok: false, error: "Profile was not found." };
      }
      if (isExamPointsProfileNameTaken(current.profiles, nextName, profileId)) {
        return { ok: false, error: "Profile name already exists." };
      }
      const renamed = touchProfile(profile, { name: nextName });
      const nextStore: ExamPointsProfilesStore = {
        ...current,
        profiles: current.profiles.map((entry) => (entry.id === profileId ? renamed : entry)),
      };
      await persistStore(nextStore);
      return { ok: true, error: null, profile: renamed };
    },
    [persistStore],
  );

  const updateProfile = useCallback(
    async (
      profileId: string,
      updater: (profile: ExamPointsProfile) => ExamPointsProfile,
    ): Promise<PointsProfileMutationResult> => {
      const current = storeRef.current;
      const profile = current.profiles.find((entry) => entry.id === profileId);
      if (!profile) {
        return { ok: false, error: "Profile was not found." };
      }
      const updated = touchProfile(profile, updater(profile));
      const nextStore: ExamPointsProfilesStore = {
        ...current,
        profiles: current.profiles.map((entry) => (entry.id === profileId ? updated : entry)),
      };
      await persistStore(nextStore);
      return { ok: true, error: null, profile: updated };
    },
    [persistStore],
  );

  const deleteProfile = useCallback(
    async (profileId: string): Promise<PointsProfileMutationResult> => {
      const current = storeRef.current;
      const profile = current.profiles.find((entry) => entry.id === profileId);
      if (!profile) {
        return { ok: false, error: "Profile was not found." };
      }
      if (current.profiles.length <= 1) {
        return { ok: false, error: "At least one profile must remain." };
      }
      const nextProfiles = current.profiles.filter((entry) => entry.id !== profileId);
      const nextDefaultId =
        current.defaultProfileId === profileId
          ? (nextProfiles[0]?.id ?? null)
          : current.defaultProfileId;
      const nextStore: ExamPointsProfilesStore = {
        ...current,
        profiles: nextProfiles,
        defaultProfileId: nextDefaultId,
      };
      await persistStore(nextStore);
      if (selectedProfileId === profileId) {
        setSelectedProfileId(nextDefaultId);
      }
      return { ok: true, error: null, profile };
    },
    [persistStore, selectedProfileId],
  );

  const setDefaultProfileId = useCallback(
    async (profileId: string) => {
      const current = storeRef.current;
      if (!current.profiles.some((profile) => profile.id === profileId)) {
        return false;
      }
      const nextStore: ExamPointsProfilesStore = {
        ...current,
        defaultProfileId: profileId,
      };
      await persistStore(nextStore);
      return true;
    },
    [persistStore],
  );

  const saveNow = useCallback(async () => {
    await persistStore(storeRef.current);
    return true;
  }, [persistStore]);

  return {
    profiles,
    loading,
    saving,
    error,
    defaultProfileId: store.defaultProfileId,
    defaultProfile,
    selectedProfileId,
    selectedProfile,
    setSelectedProfileId,
    resolveProfileByName,
    resolveAssignedProfile,
    createProfile,
    renameProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfileId,
    saveNow,
  };
};

export type UseExamPointsProfilesHandle = ReturnType<typeof useExamPointsProfiles>;
