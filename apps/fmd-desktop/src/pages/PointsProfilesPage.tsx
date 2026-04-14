/**
 * @file apps/fmd-desktop/src/pages/PointsProfilesPage.tsx
 *
 * Dedicated management page for points profiles and profile usage monitoring.
 */

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnchoredPopup } from "../components/AnchoredPopup";
import { useAppState } from "../components/AppStateProvider";
import {
  EXAM_POINTS_DEFAULT_DURATION_MINUTES,
  EXAM_POINTS_MAX_TASK_COUNT,
  createDefaultTypeRules,
  normalizeTaskPoints,
  normalizeTypeRules,
  type ExamPointsDistribution,
  type ExamPointsProfile,
} from "../lib/exam/pointsProfiles";
import { resolveExamTaskFrontmatterValue } from "../features/exam-points/frontmatterTask";
import { AUTO_CARD_TYPES } from "../lib/exam/autoCards";
import { compareNaturalPath } from "../lib/naturalSort";
import type { LoadState } from "../lib/types";

type DraftPointsTypeRule = {
  points: string;
  mode: "all-or-nothing" | "partial";
  penalty: string;
};

type DraftPointsTypeRuleMap = Record<string, DraftPointsTypeRule>;

type PointsProfileUsageGroup = {
  key: string;
  profileId: string | null;
  profileName: string;
  isMissingProfile: boolean;
  assignedFiles: string[];
  assignedFileCount: number;
};

const clampNonNegativeInteger = (value: string | number, fallback = 0) => {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value).trim() || String(fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
};

const toTaskPointsDraft = (profile: ExamPointsProfile) =>
  profile.taskPoints
    .slice(0, EXAM_POINTS_MAX_TASK_COUNT)
    .map((points) => String(Math.max(0, Math.floor(points))));

const toTypeRulesDraft = (profile: ExamPointsProfile): DraftPointsTypeRuleMap =>
  AUTO_CARD_TYPES.reduce((acc, type) => {
    const rule = profile.typeRules[type];
    acc[type] = {
      points: String(Math.max(0, Math.floor(rule?.points ?? 0))),
      mode: rule?.mode === "partial" ? "partial" : "all-or-nothing",
      penalty: String(Math.max(0, Math.floor(rule?.penalty ?? 0))),
    };
    return acc;
  }, {} as DraftPointsTypeRuleMap);

const sortUsageGroups = (groups: PointsProfileUsageGroup[]) =>
  groups.sort((left, right) => {
    if (left.isMissingProfile !== right.isMissingProfile) {
      return left.isMissingProfile ? 1 : -1;
    }
    return left.profileName.localeCompare(right.profileName);
  });

export const PointsProfilesPage = () => {
  const { pointsProfiles, vault } = useAppState();

  const [pointsMessage, setPointsMessage] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [newPointsProfileName, setNewPointsProfileName] = useState("");
  const [draftProfileName, setDraftProfileName] = useState("");
  const [, setDraftDistribution] = useState<ExamPointsDistribution>("task-order");
  const [draftTaskCount, setDraftTaskCount] = useState("5");
  const [draftMaxTotalPoints, setDraftMaxTotalPoints] = useState("20");
  const [draftDurationMinutes, setDraftDurationMinutes] = useState(
    String(EXAM_POINTS_DEFAULT_DURATION_MINUTES),
  );
  const [draftTaskPoints, setDraftTaskPoints] = useState<string[]>(
    Array.from({ length: EXAM_POINTS_MAX_TASK_COUNT }, () => "0"),
  );
  const [draftTypeRules, setDraftTypeRules] = useState<DraftPointsTypeRuleMap>(() =>
    toTypeRulesDraft({
      id: "draft",
      name: "draft",
      distribution: "task-order",
      durationMinutes: EXAM_POINTS_DEFAULT_DURATION_MINUTES,
      taskCount: 5,
      maxTotalPoints: 20,
      taskPoints: Array.from({ length: EXAM_POINTS_MAX_TASK_COUNT }, () => 0),
      typeRules: createDefaultTypeRules(1),
      createdAt: "",
      updatedAt: "",
      version: 1,
    }),
  );

  const [monitoringState, setMonitoringState] = useState<LoadState>("idle");
  const [monitoringError, setMonitoringError] = useState("");
  const [profileUsages, setProfileUsages] = useState<PointsProfileUsageGroup[]>([]);
  const [activeUsageKey, setActiveUsageKey] = useState<string | null>(null);
  const usagePopupAnchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const selectedProfile = pointsProfiles.selectedProfile;
    if (!selectedProfile) {
      return;
    }
    setDraftProfileName(selectedProfile.name);
    setDraftDistribution("task-order");
    setDraftDurationMinutes(String(selectedProfile.durationMinutes));
    setDraftTaskCount(String(selectedProfile.taskCount));
    setDraftMaxTotalPoints(String(selectedProfile.maxTotalPoints));
    setDraftTaskPoints(toTaskPointsDraft(selectedProfile));
    setDraftTypeRules(toTypeRulesDraft(selectedProfile));
    setPointsError("");
    setPointsMessage("");
  }, [pointsProfiles.selectedProfile]);

  const scanProfileUsage = useCallback(async () => {
    if (!vault.vaultPath) {
      setProfileUsages([]);
      setMonitoringState("idle");
      setMonitoringError("");
      setActiveUsageKey(null);
      return;
    }

    const markdownFiles = vault.files.filter((file) =>
      file.relative_path.toLowerCase().endsWith(".md"),
    );

    if (markdownFiles.length === 0) {
      setProfileUsages([]);
      setMonitoringState("idle");
      setMonitoringError("");
      setActiveUsageKey(null);
      return;
    }

    setMonitoringState("loading");
    setMonitoringError("");

    const fileAssignments = await Promise.allSettled(
      markdownFiles.map(async (file) => {
        const contents = await invoke<string>("read_text_file", {
          path: file.path,
        });
        return {
          relativePath: file.relative_path,
          assignedProfile: resolveExamTaskFrontmatterValue(contents),
        };
      }),
    );

    const usageMap = new Map<
      string,
      {
        profileId: string | null;
        profileName: string;
        isMissingProfile: boolean;
        files: Set<string>;
      }
    >();

    let failedReads = 0;

    fileAssignments.forEach((assignment) => {
      if (assignment.status !== "fulfilled") {
        failedReads += 1;
        return;
      }
      const assignedName = assignment.value.assignedProfile?.trim() ?? "";
      if (!assignedName) {
        return;
      }

      const resolvedProfile = pointsProfiles.resolveProfileByName(assignedName);
      const key = resolvedProfile
        ? `profile:${resolvedProfile.id}`
        : `missing:${assignedName.toLocaleLowerCase()}`;
      const existing = usageMap.get(key);

      if (existing) {
        existing.files.add(assignment.value.relativePath);
        return;
      }

      usageMap.set(key, {
        profileId: resolvedProfile?.id ?? null,
        profileName: resolvedProfile?.name ?? assignedName,
        isMissingProfile: !resolvedProfile,
        files: new Set([assignment.value.relativePath]),
      });
    });

    const nextGroups = sortUsageGroups(
      Array.from(usageMap.entries()).map(([key, value]) => {
        const assignedFiles = Array.from(value.files).sort(compareNaturalPath);
        return {
          key,
          profileId: value.profileId,
          profileName: value.profileName,
          isMissingProfile: value.isMissingProfile,
          assignedFiles,
          assignedFileCount: assignedFiles.length,
        };
      }),
    );

    setProfileUsages(nextGroups);
    setMonitoringState("idle");

    if (failedReads > 0 && nextGroups.length === 0) {
      setMonitoringError("Profile monitoring scan failed for one or more files.");
    } else {
      setMonitoringError("");
    }

    setActiveUsageKey((previous) => {
      if (!previous) {
        return null;
      }
      return nextGroups.some((group) => group.key === previous) ? previous : null;
    });
  }, [pointsProfiles.resolveProfileByName, vault.files, vault.vaultPath]);

  useEffect(() => {
    void scanProfileUsage();
  }, [scanProfileUsage]);

  const usageCountByProfileId = useMemo(() => {
    const map = new Map<string, number>();
    profileUsages.forEach((usage) => {
      if (!usage.profileId) {
        return;
      }
      map.set(usage.profileId, usage.assignedFileCount);
    });
    return map;
  }, [profileUsages]);

  const monitoringSummary = useMemo(() => {
    const assignedFileCount = profileUsages.reduce(
      (sum, usage) => sum + usage.assignedFileCount,
      0,
    );
    return {
      groups: profileUsages.length,
      assignedFileCount,
    };
  }, [profileUsages]);

  const activeUsage = useMemo(
    () =>
      activeUsageKey
        ? profileUsages.find((usage) => usage.key === activeUsageKey) ?? null
        : null,
    [activeUsageKey, profileUsages],
  );

  const handleCreatePointsProfile = useCallback(async () => {
    const requestedName = newPointsProfileName.trim();
    if (!requestedName) {
      setPointsError("Profile name is required.");
      return;
    }
    setPointsError("");
    setPointsMessage("");
    const created = await pointsProfiles.createProfile(requestedName, {
      seedFromProfileId: pointsProfiles.selectedProfileId,
    });
    if (!created.ok || !created.profile) {
      setPointsError(created.error ?? "Profile could not be created.");
      return;
    }
    setNewPointsProfileName("");
    setPointsMessage(`Profile "${created.profile.name}" created.`);
  }, [newPointsProfileName, pointsProfiles]);

  const handleSetSelectedProfileAsDefault = useCallback(async () => {
    const selectedId = pointsProfiles.selectedProfileId;
    if (!selectedId) {
      return;
    }
    const ok = await pointsProfiles.setDefaultProfileId(selectedId);
    if (!ok) {
      setPointsError("Default profile could not be updated.");
      return;
    }
    setPointsError("");
    setPointsMessage("Default profile updated.");
  }, [pointsProfiles]);

  const handleDeleteSelectedPointsProfile = useCallback(async () => {
    const selected = pointsProfiles.selectedProfile;
    if (!selected) {
      return;
    }

    const usage = profileUsages.find((entry) => entry.profileId === selected.id);
    if (usage && usage.assignedFileCount > 0) {
      const preview = usage.assignedFiles.slice(0, 3).join(", ");
      const suffix = usage.assignedFileCount > 3
        ? ` (+${usage.assignedFileCount - 3} more)`
        : "";
      setPointsError(
        `Profile "${selected.name}" is still used in ${usage.assignedFileCount} file(s): ${preview}${suffix}`,
      );
      return;
    }

    setPointsError("");
    setPointsMessage("");
    const deleted = await pointsProfiles.deleteProfile(selected.id);
    if (!deleted.ok || !deleted.profile) {
      setPointsError(deleted.error ?? "Profile could not be deleted.");
      return;
    }
    setPointsMessage(`Profile "${deleted.profile.name}" deleted.`);
    void scanProfileUsage();
  }, [pointsProfiles, profileUsages, scanProfileUsage]);

  const handleDraftTaskPointChange = useCallback((index: number, value: string) => {
    setDraftTaskPoints((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }, []);

  const handleSavePointsProfile = useCallback(async () => {
    const selected = pointsProfiles.selectedProfile;
    if (!selected) {
      return;
    }
    const nextName = draftProfileName.trim();
    if (!nextName) {
      setPointsError("Profile name is required.");
      return;
    }

    setPointsError("");
    setPointsMessage("");

    let renamedName = selected.name;
    if (nextName !== selected.name) {
      const renamed = await pointsProfiles.renameProfile(selected.id, nextName);
      if (!renamed.ok || !renamed.profile) {
        setPointsError(renamed.error ?? "Profile could not be renamed.");
        return;
      }
      renamedName = renamed.profile.name;
    }

    const normalizedTaskCount = Math.min(
      EXAM_POINTS_MAX_TASK_COUNT,
      Math.max(1, clampNonNegativeInteger(draftTaskCount, selected.taskCount)),
    );
    const normalizedMax = clampNonNegativeInteger(
      draftMaxTotalPoints,
      selected.maxTotalPoints,
    );
    const normalizedDurationMinutes = Math.min(
      240,
      clampNonNegativeInteger(draftDurationMinutes, selected.durationMinutes),
    );
    const nextTaskPoints = normalizeTaskPoints(
      draftTaskPoints.map((entry) => clampNonNegativeInteger(entry, 0)),
      normalizedTaskCount,
      normalizedMax,
    );
    const nextTypeRules = normalizeTypeRules(
      AUTO_CARD_TYPES.reduce((acc, type) => {
        const draft = draftTypeRules[type];
        acc[type] = {
          points: clampNonNegativeInteger(draft?.points ?? "0", 0),
          mode: draft?.mode === "partial" ? "partial" : "all-or-nothing",
          penalty: clampNonNegativeInteger(draft?.penalty ?? "0", 0),
        };
        return acc;
      }, {} as Record<string, { points: number; mode: string; penalty: number }>),
      1,
    );

    const updated = await pointsProfiles.updateProfile(selected.id, (profile) => ({
      ...profile,
      name: renamedName,
      distribution: "task-order",
      durationMinutes: normalizedDurationMinutes,
      taskCount: normalizedTaskCount,
      maxTotalPoints: normalizedMax,
      taskPoints: nextTaskPoints,
      typeRules: nextTypeRules,
    }));
    if (!updated.ok || !updated.profile) {
      setPointsError(updated.error ?? "Profile could not be saved.");
      return;
    }
    setPointsMessage(`Profile "${updated.profile.name}" saved.`);
    void scanProfileUsage();
  }, [
    draftDurationMinutes,
    draftMaxTotalPoints,
    draftProfileName,
    draftTaskCount,
    draftTaskPoints,
    draftTypeRules,
    pointsProfiles,
    scanProfileUsage,
  ]);

  const handleOpenUsagePopup = useCallback((usageKey: string, anchor: HTMLElement) => {
    usagePopupAnchorRef.current = anchor;
    setActiveUsageKey(usageKey);
  }, []);

  const handleCloseUsagePopup = useCallback(() => {
    setActiveUsageKey(null);
  }, []);

  const normalizedDraftTaskCount = Math.min(
    EXAM_POINTS_MAX_TASK_COUNT,
    Math.max(1, clampNonNegativeInteger(draftTaskCount, 1)),
  );
  const draftTaskPointsSum = draftTaskPoints
    .slice(0, normalizedDraftTaskCount)
    .reduce((sum, value) => sum + clampNonNegativeInteger(value, 0), 0);

  return (
    <div className="points-profiles-page">
      <section className="panel points-profiles-panel">
        <div className="panel-header">
          <div>
            <h2>Points Profiles Profile Editor</h2>
            <p className="muted">
              Manage scoring profiles independently from the Exam Editor.
            </p>
          </div>
        </div>

        <div className="points-profiles-layout">
          <aside className="panel points-profile-nav">
            <header className="panel-header">
              <div>
                <h3>Points Profiles</h3>
              </div>
            </header>
            <div className="panel-body">
              {pointsProfiles.error ? <div className="error">{pointsProfiles.error}</div> : null}
              <ul className="points-profile-list">
                {pointsProfiles.profiles.map((profile) => {
                  const isActive = profile.id === pointsProfiles.selectedProfileId;
                  const isDefault = profile.id === pointsProfiles.defaultProfileId;
                  const usageCount = usageCountByProfileId.get(profile.id) ?? 0;
                  return (
                    <li key={profile.id} className={isActive ? "active" : undefined}>
                      <button
                        type="button"
                        className="points-profile-button"
                        onClick={() => pointsProfiles.setSelectedProfileId(profile.id)}
                      >
                        <span>{profile.name}</span>
                        <span className="points-profile-list-meta">
                          {usageCount > 0 ? (
                            <span className="muted small">{usageCount} file{usageCount === 1 ? "" : "s"}</span>
                          ) : null}
                          {isDefault ? <span className="muted small">Default</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="points-profile-create">
                <input
                  type="text"
                  className="text-input"
                  placeholder="New profile name"
                  value={newPointsProfileName}
                  onChange={(event) => setNewPointsProfileName(event.target.value)}
                />
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => void handleCreatePointsProfile()}
                  disabled={pointsProfiles.saving}
                >
                  Create
                </button>
              </div>
              <div className="points-profile-actions">
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => void handleSetSelectedProfileAsDefault()}
                  disabled={
                    !pointsProfiles.selectedProfileId ||
                    pointsProfiles.selectedProfileId === pointsProfiles.defaultProfileId
                  }
                >
                  Set as default
                </button>
                <button
                  type="button"
                  className="ghost small danger"
                  onClick={() => void handleDeleteSelectedPointsProfile()}
                  disabled={!pointsProfiles.selectedProfileId}
                >
                  Delete
                </button>
              </div>
            </div>
          </aside>

          <section className="panel points-profile-editor">
            <header className="panel-header">
              <div>
                <h3>Profile Editor</h3>
              </div>
              <button
                type="button"
                className="primary small"
                onClick={() => void handleSavePointsProfile()}
                disabled={!pointsProfiles.selectedProfile || pointsProfiles.saving}
              >
                Save profile
              </button>
            </header>
            <div className="panel-body">
              <div className="points-profile-content-box">
                {pointsMessage ? <div className="muted">{pointsMessage}</div> : null}
                {pointsError ? <div className="error">{pointsError}</div> : null}
                {!pointsProfiles.selectedProfile ? (
                  <div className="exam-canvas-empty">
                    <p>Select a profile to edit.</p>
                  </div>
                ) : (
                  <div className="points-profile-form">
                    <label className="setting-row">
                      <span className="label">PROFILE NAME</span>
                      <input
                        type="text"
                        className="text-input"
                        value={draftProfileName}
                        onChange={(event) => setDraftProfileName(event.target.value)}
                      />
                    </label>
                    <label className="setting-row">
                      <span className="label">DURATION</span>
                      <div className="points-profile-duration-input">
                        <input
                          type="number"
                          min={0}
                          max={240}
                          className="text-input exam-compact-input"
                          value={draftDurationMinutes}
                          onChange={(event) => setDraftDurationMinutes(event.target.value)}
                        />
                        <span className="muted">min</span>
                      </div>
                    </label>
                    <div className="points-profile-grid">
                      <label className="setting-row">
                        <span className="label">TASK COUNT</span>
                        <input
                          type="number"
                          min={1}
                          max={EXAM_POINTS_MAX_TASK_COUNT}
                          className="text-input exam-compact-input"
                          value={draftTaskCount}
                          onChange={(event) => setDraftTaskCount(event.target.value)}
                        />
                      </label>
                      <label className="setting-row">
                        <span className="label">MAX TOTAL POINTS</span>
                        <input
                          type="number"
                          min={0}
                          className="text-input exam-compact-input"
                          value={draftMaxTotalPoints}
                          onChange={(event) => setDraftMaxTotalPoints(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="exam-points-table points-profiles-task-points-table">
                      {Array.from({ length: normalizedDraftTaskCount }, (_, index) => (
                        <div key={`points-task-${index}`} className="exam-points-row">
                          <span className="label">TASK {index + 1}</span>
                          <input
                            type="number"
                            min={0}
                            className="text-input exam-compact-input"
                            value={draftTaskPoints[index] ?? "0"}
                            onChange={(event) =>
                              handleDraftTaskPointChange(index, event.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="muted">
                      Sum assigned: {draftTaskPointsSum} / Max total:{" "}
                      {clampNonNegativeInteger(draftMaxTotalPoints, 0)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="panel points-profiles-monitoring-panel">
        <div className="panel-header">
          <div>
            <h3>Monitoring</h3>
            <p className="muted">
              {monitoringSummary.assignedFileCount} assigned .md file
              {monitoringSummary.assignedFileCount === 1 ? "" : "s"} across{" "}
              {monitoringSummary.groups} profile group
              {monitoringSummary.groups === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => void scanProfileUsage()}
              disabled={monitoringState === "loading"}
            >
              Rescan
            </button>
          </div>
        </div>

        <div className="panel-body">
          {monitoringError ? <div className="error">{monitoringError}</div> : null}
          {monitoringState === "loading" ? (
            <div className="muted">Scanning profile usage...</div>
          ) : null}
          {monitoringState !== "loading" && profileUsages.length === 0 ? (
            <div className="muted">No profile assignments found in markdown files.</div>
          ) : null}

          {profileUsages.length > 0 ? (
            <ul className="points-profile-monitoring-list">
              {profileUsages.map((usage) => {
                const popupOpen = activeUsageKey === usage.key;
                return (
                  <li key={usage.key} className="points-profile-monitoring-item">
                    <button
                      type="button"
                      className="points-profile-monitoring-toggle"
                      onClick={(event) => handleOpenUsagePopup(usage.key, event.currentTarget)}
                      aria-haspopup="dialog"
                      aria-expanded={popupOpen}
                    >
                      <span className="points-profile-monitoring-name">
                        {usage.isMissingProfile
                          ? `Missing profile: ${usage.profileName}`
                          : usage.profileName}
                      </span>
                      <span className="points-profile-monitoring-count">
                        {usage.assignedFileCount} file{usage.assignedFileCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <AnchoredPopup
            isOpen={Boolean(activeUsage)}
            onClose={handleCloseUsagePopup}
            anchorRef={usagePopupAnchorRef}
            closeLayerId="points-profile-monitoring-popup"
            ariaLabel={
              activeUsage ? `Profile assignments: ${activeUsage.profileName}` : "Profile assignments"
            }
            mode="centered"
            className="points-profile-monitoring-popup"
          >
            {activeUsage ? (
              <section className="panel points-profile-monitoring-popup-panel">
                <header className="panel-header">
                  <div>
                    <h4>
                      {activeUsage.isMissingProfile
                        ? `Missing profile: ${activeUsage.profileName}`
                        : activeUsage.profileName}
                    </h4>
                    <p className="muted">
                      {activeUsage.assignedFileCount} assigned .md file
                      {activeUsage.assignedFileCount === 1 ? "" : "s"}.
                    </p>
                  </div>
                </header>
                <div className="panel-body">
                  <ul className="points-profile-monitoring-popup-files">
                    {activeUsage.assignedFiles.map((file) => (
                      <li key={`${activeUsage.key}:${file}`}>{file}</li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}
          </AnchoredPopup>
        </div>
      </section>
    </div>
  );
};
