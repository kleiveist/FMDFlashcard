/**
 * @file apps/fmd-desktop/src/features/preview/database/views/project-view.tsx
 *
 * Editable block-based project visualization for database records.
 */

import {
  type KeyboardEvent as ReactKeyboardEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseProjectBarFillConfig,
  type DatabaseProjectBarFillMode,
  type DatabaseProjectMissingPlacement,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "../database-types";
import {
  formatMonitoringCompactText,
  renderMonitoringValue,
  type MonitoringRenderProfile,
} from "../../../monitoring/monitoring-render-rules";
import { AnchoredPopup } from "../../../../components/AnchoredPopup";
import {
  DRAG_CHANNELS,
  endInternalDrag,
  readInternalDragText,
  setDropEffectSafe,
  startInternalDrag,
} from "../../../../lib/dragDrop";

type DatabaseProjectViewProps = {
  records: DatabaseRecord[];
  attributes?: DatabaseAttributeMeta[];
  startField: string;
  unitField: string;
  resolution: number;
  defaultUnits: number;
  missingPlacement: DatabaseProjectMissingPlacement;
  barFillConfigs?: DatabaseProjectBarFillConfig[];
  visibleProperties: DatabaseAttributeMeta[];
  monitoringProfiles?: MonitoringRenderProfile[];
  editable?: boolean;
  pendingRecordIds?: string[];
  onOpenRecord?: (record: DatabaseRecord) => void;
  onOpenExamFromRecord?: (record: DatabaseRecord) => void;
  onChangeBarFillConfig?: (recordId: string, config: DatabaseProjectBarFillConfig | null) => void;
  onApplyBarFillConfigToVisible?: (
    config: DatabaseProjectBarFillConfig,
    records: DatabaseRecord[],
  ) => Promise<void>;
  onCommitPlacement?: (params: {
    record: DatabaseRecord;
    startSlot: number;
    units: number;
  }) => void;
};

type ProjectBarConfigDraft = {
  attributeKey: string;
  mode: DatabaseProjectBarFillMode;
  min: string;
  max: string;
  mappings: Array<{
    from: string;
    to: string;
  }>;
};

type ProjectEntry = {
  record: DatabaseRecord;
  title: string;
  startSlot: number;
  units: number;
  tooltip: string;
};

type InteractionState =
  | {
      kind: "move";
      recordId: string;
      originStartSlot: number;
      originUnits: number;
      pointerStartX: number;
    }
  | {
      kind: "resize-start";
      recordId: string;
      originStartSlot: number;
      originUnits: number;
      pointerStartX: number;
    }
  | {
      kind: "resize-end";
      recordId: string;
      originStartSlot: number;
      originUnits: number;
      pointerStartX: number;
    };

const SLOT_WIDTH = 18;
const SIDEBAR_WIDTH = 280;
const ROW_META_MAX_WIDTH = 320;
const ROW_META_EDGE_PADDING = 8;
const KEYBOARD_SCROLL_STEP_X = 48;
const KEYBOARD_SCROLL_STEP_Y = 40;

const toLower = (value: string) => value.trim().toLowerCase();
const isExamFieldKey = (key: string) => toLower(key) === "exam";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getNearestScrollHost = (element: HTMLElement | null): HTMLElement | null => {
  if (!element || typeof window === "undefined") {
    return null;
  }
  let current: HTMLElement | null = element;
  while (current) {
    const style = window.getComputedStyle(current);
    const canScrollX = /(auto|scroll)/.test(style.overflowX) && current.scrollWidth > current.clientWidth;
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
    if (canScrollX || canScrollY) {
      return current;
    }
    current = current.parentElement;
  }
  const fallback = document.scrollingElement;
  return fallback instanceof HTMLElement ? fallback : null;
};

const getRowTitle = (record: DatabaseRecord) => {
  const fromSystem = record.systemFields.Dateiname;
  if (typeof fromSystem === "string" && fromSystem.trim().length > 0) {
    return fromSystem;
  }
  return record.relativePath;
};

const getRecordValueByField = (record: DatabaseRecord, field: string): DatabaseNormalizedFieldValue => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = toLower(field);
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => toLower(key) === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNumericValue = (value: DatabaseNormalizedFieldValue): number | null => {
  const direct = asFiniteNumber(value);
  if (direct !== null) {
    return direct;
  }
  if (value && typeof value === "object") {
    const objectValue = value as {
      value?: unknown;
      ratio?: unknown;
      rank?: unknown;
      raw?: unknown;
    };
    const fromValue = asFiniteNumber(objectValue.value);
    if (fromValue !== null) {
      return fromValue;
    }
    const fromRatio = asFiniteNumber(objectValue.ratio);
    if (fromRatio !== null) {
      return fromRatio;
    }
    const fromRank = asFiniteNumber(objectValue.rank);
    if (fromRank !== null) {
      return fromRank;
    }
    const fromRaw = asFiniteNumber(objectValue.raw);
    if (fromRaw !== null) {
      return fromRaw;
    }
  }
  return null;
};

const toComparableTextValue = (value: DatabaseNormalizedFieldValue): string | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry) => String(entry).trim()).filter(Boolean);
    return entries.length > 0 ? entries.join(", ") : null;
  }
  if (typeof value === "object") {
    const objectValue = value as {
      raw?: unknown;
      code?: unknown;
      label?: unknown;
      value?: unknown;
    };
    if (typeof objectValue.code === "string") {
      const code = objectValue.code.trim();
      if (code) {
        return code;
      }
    }
    if (typeof objectValue.raw === "string") {
      const raw = objectValue.raw.trim();
      if (raw) {
        return raw;
      }
    }
    if (typeof objectValue.label === "string") {
      const label = objectValue.label.trim();
      if (label) {
        return label;
      }
    }
    if (
      typeof objectValue.value === "string" ||
      typeof objectValue.value === "number" ||
      typeof objectValue.value === "boolean"
    ) {
      const text = String(objectValue.value).trim();
      if (text) {
        return text;
      }
    }
  }
  return null;
};

const createDefaultProjectBarConfigDraft = (
  attributes: DatabaseAttributeMeta[],
): ProjectBarConfigDraft => ({
  attributeKey: attributes[0]?.key ?? "",
  mode: "numeric",
  min: "0",
  max: "100",
  mappings: [
    {
      from: "",
      to: "",
    },
  ],
});

const createProjectBarConfigDraft = (
  config: DatabaseProjectBarFillConfig | null,
  attributes: DatabaseAttributeMeta[],
): ProjectBarConfigDraft => {
  const fallback = createDefaultProjectBarConfigDraft(attributes);
  if (!config) {
    return fallback;
  }
  if (config.mode === "text-code") {
    const mappings = (config.mappings ?? []).map((entry) => ({
      from: entry.from,
      to: String(entry.to),
    }));
    return {
      attributeKey: config.attributeKey || fallback.attributeKey,
      mode: "text-code",
      min: "0",
      max: "100",
      mappings: mappings.length > 0
        ? mappings
        : fallback.mappings,
    };
  }
  return {
    attributeKey: config.attributeKey || fallback.attributeKey,
    mode: "numeric",
    min: typeof config.min === "number" && Number.isFinite(config.min) ? String(config.min) : "0",
    max: typeof config.max === "number" && Number.isFinite(config.max) ? String(config.max) : "100",
    mappings: fallback.mappings,
  };
};

const toNormalizedProjectBarConfig = (
  recordId: string,
  draft: ProjectBarConfigDraft,
): DatabaseProjectBarFillConfig | null => {
  const normalizedRecordId = recordId.trim();
  const attributeKey = draft.attributeKey.trim();
  if (!normalizedRecordId || !attributeKey) {
    return null;
  }
  if (draft.mode === "text-code") {
    return {
      recordId: normalizedRecordId,
      attributeKey,
      mode: "text-code",
      mappings: draft.mappings
        .map((entry) => {
          const from = entry.from.trim();
          const to = asFiniteNumber(entry.to);
          if (!from || to === null) {
            return null;
          }
          return {
            from,
            to,
          };
        })
        .filter((entry): entry is { from: string; to: number } => Boolean(entry)),
    };
  }
  const min = asFiniteNumber(draft.min);
  const max = asFiniteNumber(draft.max);
  const hasValidRange = min !== null && max !== null && max > min;
  return {
    recordId: normalizedRecordId,
    attributeKey,
    mode: "numeric",
    ...(hasValidRange ? { min, max } : {}),
  };
};

const resolveProjectBarFillRatio = (
  record: DatabaseRecord,
  config: DatabaseProjectBarFillConfig | null,
): number | null => {
  if (!config || !config.attributeKey.trim()) {
    return null;
  }
  const value = getRecordValueByField(record, config.attributeKey);
  if (config.mode === "text-code") {
    const textValue = toComparableTextValue(value);
    if (!textValue) {
      return null;
    }
    const matched = (config.mappings ?? []).find((entry) =>
      toLower(entry.from) === toLower(textValue));
    if (!matched) {
      return null;
    }
    const percent = asFiniteNumber(matched.to);
    if (percent === null) {
      return null;
    }
    return clamp(percent / 100, 0, 1);
  }
  const numericValue = toNumericValue(value);
  if (numericValue === null) {
    return null;
  }
  const min = asFiniteNumber(config.min);
  const max = asFiniteNumber(config.max);
  if (min === null || max === null || max <= min) {
    return null;
  }
  return clamp((numericValue - min) / (max - min), 0, 1);
};

const stringifyMetaValue = (
  attributeKey: string,
  value: DatabaseNormalizedFieldValue,
  type: DatabaseAttributeMeta["type"],
  monitoringProfiles: MonitoringRenderProfile[],
): string | null => {
  const monitoringText = formatMonitoringCompactText(
    renderMonitoringValue({
      attributeKey,
      value,
      profiles: monitoringProfiles,
    }),
    value,
  ).trim();
  if (monitoringText) {
    return monitoringText;
  }
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (value instanceof Date) {
    if (type === "time") {
      return value.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (type === "date") {
      return value.toLocaleDateString();
    }
    return value.toLocaleString();
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry) => String(entry).trim()).filter(Boolean);
    return entries.length > 0 ? entries.join(", ") : null;
  }
  if (typeof value === "object") {
    const objectValue = value as {
      value?: unknown;
      raw?: unknown;
    };
    if (typeof objectValue.value === "number" && Number.isFinite(objectValue.value)) {
      return String(objectValue.value);
    }
    if (typeof objectValue.raw !== "undefined") {
      const raw = String(objectValue.raw ?? "").trim();
      return raw || null;
    }
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  const text = String(value).trim();
  return text || null;
};

const buildEntry = ({
  record,
  startField,
  unitField,
  resolution,
}: {
  record: DatabaseRecord;
  startField: string;
  unitField: string;
  resolution: number;
}): ProjectEntry | null => {
  const startRaw = getRecordValueByField(record, startField);
  const unitsRaw = getRecordValueByField(record, unitField);
  const startNumeric = toNumericValue(startRaw);
  const unitsNumeric = toNumericValue(unitsRaw);

  if (startNumeric === null || unitsNumeric === null) {
    return null;
  }

  const startSlot = Math.round(startNumeric);
  const units = Math.round(unitsNumeric);
  if (!Number.isFinite(startSlot) || !Number.isFinite(units)) {
    return null;
  }
  if (startSlot < 0 || units < 1) {
    return null;
  }

  const clampedStart = clamp(startSlot, 0, Math.max(0, resolution - 1));
  const clampedUnits = clamp(units, 1, Math.max(1, resolution - clampedStart));
  const title = getRowTitle(record);

  return {
    record,
    title,
    startSlot: clampedStart,
    units: clampedUnits,
    tooltip: `${title}\nSlot: ${clampedStart}\nUnits: ${clampedUnits}\n${record.relativePath}`,
  };
};

export const DatabaseProjectView = ({
  records,
  attributes = [],
  startField,
  unitField,
  resolution,
  defaultUnits,
  missingPlacement,
  barFillConfigs = [],
  visibleProperties,
  monitoringProfiles = [],
  editable = false,
  pendingRecordIds = [],
  onOpenRecord,
  onOpenExamFromRecord,
  onChangeBarFillConfig,
  onApplyBarFillConfigToVisible,
  onCommitPlacement,
}: DatabaseProjectViewProps) => {
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [draftByRecordId, setDraftByRecordId] = useState<Record<string, { startSlot: number; units: number }>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1200 : false,
  );
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const configAnchorRef = useRef<HTMLElement | null>(null);
  const [activeConfigRecordId, setActiveConfigRecordId] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<ProjectBarConfigDraft>(
    createDefaultProjectBarConfigDraft(attributes),
  );
  const [isApplyingBarRule, setIsApplyingBarRule] = useState(false);

  const barFillConfigByRecordId = useMemo(() => {
    const map = new Map<string, DatabaseProjectBarFillConfig>();
    barFillConfigs.forEach((entry) => {
      if (!entry.recordId.trim() || !entry.attributeKey.trim()) {
        return;
      }
      map.set(entry.recordId, {
        ...entry,
        mappings: (entry.mappings ?? []).map((mapping) => ({ ...mapping })),
      });
    });
    return map;
  }, [barFillConfigs]);

  const sortedAttributes = useMemo(
    () =>
      [...attributes].sort((left, right) =>
        (left.label || left.key).localeCompare(right.label || right.key)),
    [attributes],
  );

  const entryByRecordId = useMemo(() => {
    const map = new Map<string, ProjectEntry>();
    records.forEach((record) => {
      const entry = buildEntry({
        record,
        startField,
        unitField,
        resolution,
      });
      if (entry) {
        map.set(record.fileId, entry);
      }
    });
    return map;
  }, [records, resolution, startField, unitField]);

  const pendingIds = useMemo(() => new Set(pendingRecordIds), [pendingRecordIds]);
  const recordById = useMemo(() => new Map(records.map((record) => [record.fileId, record])), [records]);
  const slotBoundaries = useMemo(() =>
    Array.from({ length: resolution }, (_, index) => index),
  [resolution]);
  const rowMetaClampMax = Math.max(
    ROW_META_EDGE_PADDING,
    resolution * SLOT_WIDTH - (ROW_META_MAX_WIDTH + ROW_META_EDGE_PADDING),
  );

  const visibleRecords = useMemo(
    () => missingPlacement === "hide-unplaced"
      ? records.filter((record) => entryByRecordId.has(record.fileId))
      : records,
    [entryByRecordId, missingPlacement, records],
  );
  const activeConfig = activeConfigRecordId
    ? barFillConfigByRecordId.get(activeConfigRecordId) ?? null
    : null;

  useEffect(() => {
    if (!activeConfigRecordId) {
      return;
    }
    if (!recordById.has(activeConfigRecordId)) {
      setActiveConfigRecordId(null);
      configAnchorRef.current = null;
    }
  }, [activeConfigRecordId, recordById]);

  useEffect(() => {
    if (!activeConfigRecordId) {
      return;
    }
    setConfigDraft(createProjectBarConfigDraft(activeConfig, sortedAttributes));
  }, [activeConfig, activeConfigRecordId, sortedAttributes]);

  const handleOpenBarConfig = (recordId: string, anchorElement: HTMLElement) => {
    configAnchorRef.current = anchorElement;
    setActiveConfigRecordId(recordId);
  };

  const handleCloseBarConfig = () => {
    setActiveConfigRecordId(null);
    configAnchorRef.current = null;
  };

  const handleSaveBarConfig = () => {
    if (!activeConfigRecordId) {
      return;
    }
    onChangeBarFillConfig?.(
      activeConfigRecordId,
      toNormalizedProjectBarConfig(activeConfigRecordId, configDraft),
    );
    handleCloseBarConfig();
  };

  const handleRemoveBarConfig = () => {
    if (!activeConfigRecordId) {
      return;
    }
    onChangeBarFillConfig?.(activeConfigRecordId, null);
    handleCloseBarConfig();
  };

  const handleApplyBarConfigToVisible = async () => {
    if (!activeConfigRecordId || !onApplyBarFillConfigToVisible || isApplyingBarRule) {
      return;
    }
    const config = toNormalizedProjectBarConfig(activeConfigRecordId, configDraft);
    if (!config) {
      return;
    }
    setIsApplyingBarRule(true);
    try {
      await onApplyBarFillConfigToVisible(config, visibleRecords);
    } finally {
      setIsApplyingBarRule(false);
    }
  };

  useEffect(() => {
    if (!interaction) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const deltaSlots = Math.round((event.clientX - interaction.pointerStartX) / SLOT_WIDTH);
      let nextStart = interaction.originStartSlot;
      let nextUnits = interaction.originUnits;

      if (interaction.kind === "move") {
        const maxStart = Math.max(0, resolution - interaction.originUnits);
        nextStart = clamp(interaction.originStartSlot + deltaSlots, 0, maxStart);
      } else if (interaction.kind === "resize-end") {
        nextUnits = clamp(
          interaction.originUnits + deltaSlots,
          1,
          Math.max(1, resolution - interaction.originStartSlot),
        );
      } else {
        const maxStart = interaction.originStartSlot + interaction.originUnits - 1;
        nextStart = clamp(interaction.originStartSlot + deltaSlots, 0, maxStart);
        const consumed = nextStart - interaction.originStartSlot;
        nextUnits = clamp(
          interaction.originUnits - consumed,
          1,
          Math.max(1, resolution - nextStart),
        );
      }

      setDraftByRecordId((current) => ({
        ...current,
        [interaction.recordId]: {
          startSlot: nextStart,
          units: nextUnits,
        },
      }));
    };

    const handlePointerUp = () => {
      const record = recordById.get(interaction.recordId);
      const draft = draftByRecordId[interaction.recordId];
      const nextPlacement = draft ?? {
        startSlot: interaction.originStartSlot,
        units: interaction.originUnits,
      };

      setInteraction(null);
      setDraftByRecordId((current) => {
        const next = { ...current };
        delete next[interaction.recordId];
        return next;
      });

      if (!record || !onCommitPlacement) {
        return;
      }

      const changed = nextPlacement.startSlot !== interaction.originStartSlot ||
        nextPlacement.units !== interaction.originUnits;
      if (!changed) {
        return;
      }

      onCommitPlacement({
        record,
        startSlot: nextPlacement.startSlot,
        units: nextPlacement.units,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draftByRecordId, interaction, onCommitPlacement, recordById, resolution]);

  if (resolution < 1) {
    return (
      <div className="database-view-empty">
        Blockaufloesung muss mindestens 1 sein.
      </div>
    );
  }

  const totalWidth = Math.max(SLOT_WIDTH, resolution * SLOT_WIDTH);
  const sidebarWidth = isSidebarCollapsed ? 0 : SIDEBAR_WIDTH;
  const gridTemplateColumns = `${sidebarWidth}px ${totalWidth}px`;
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) {
      return;
    }
    let left = 0;
    let top = 0;
    if (event.key === "ArrowLeft") {
      left = -KEYBOARD_SCROLL_STEP_X;
    } else if (event.key === "ArrowRight") {
      left = KEYBOARD_SCROLL_STEP_X;
    } else if (event.key === "ArrowUp") {
      top = -KEYBOARD_SCROLL_STEP_Y;
    } else if (event.key === "ArrowDown") {
      top = KEYBOARD_SCROLL_STEP_Y;
    }
    if (!left && !top) {
      return;
    }
    const host = getNearestScrollHost(gridScrollRef.current);
    if (!host) {
      return;
    }
    event.preventDefault();
    host.scrollBy({ left, top, behavior: "auto" });
  };
  const activeConfigRecord = activeConfigRecordId
    ? recordById.get(activeConfigRecordId) ?? null
    : null;
  const configRecordTitle = activeConfigRecord ? getRowTitle(activeConfigRecord) : "Datensatz";
  const isBarConfigOpen = Boolean(activeConfigRecordId && configAnchorRef.current);

  return (
    <div
      className={`database-project-view${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="database-project-mobile-controls">
        <button
          type="button"
          className="database-block-toolbar-button"
          onClick={() => setIsSidebarCollapsed((current) => !current)}
          aria-expanded={!isSidebarCollapsed}
          data-md-block-control="true"
        >
          {isSidebarCollapsed ? "Datensatz anzeigen" : "Datensatz ausblenden"}
        </button>
      </div>

      <div className="database-project-grid-scroll" ref={gridScrollRef}>
        <div
          className="database-project-grid"
          style={{
            gridTemplateColumns,
          }}
        >
          {!isSidebarCollapsed ? (
            <div className="database-project-sidebar-header">Datensatz</div>
          ) : null}
          <div className="database-project-header-scale">
            {slotBoundaries.map((slot) => (
              <span
                key={slot}
                className={`database-project-header-tick${slot % 5 === 0 ? " is-major" : ""}`}
                style={{ left: `${slot * SLOT_WIDTH}px`, width: `${SLOT_WIDTH}px` }}
                title={`Slot ${slot}`}
              >
                {slot % 5 === 0 ? slot : ""}
              </span>
            ))}
          </div>

          {visibleRecords.map((record) => {
            const entry = entryByRecordId.get(record.fileId) ?? null;
            const draft = draftByRecordId[record.fileId];
            const displayStart = draft?.startSlot ?? entry?.startSlot ?? null;
            const displayUnits = draft?.units ?? entry?.units ?? null;
            const hasPlacement = displayStart !== null && displayUnits !== null;
            const startX = hasPlacement ? displayStart * SLOT_WIDTH : null;
            const width = hasPlacement ? Math.max(8, displayUnits * SLOT_WIDTH) : 0;
            const rowTitle = getRowTitle(record);
            const isPending = pendingIds.has(record.fileId);
            const barFillConfig = barFillConfigByRecordId.get(record.fileId) ?? null;
            const barFillRatio = resolveProjectBarFillRatio(record, barFillConfig);
            const barFillPercent = barFillRatio === null ? 0 : Math.max(0, Math.min(100, barFillRatio * 100));
            const excludedPropertyKeys = new Set<string>([
              toLower(startField),
              toLower(unitField),
            ]);
            const propertyRows = visibleProperties
              .filter((attribute) => !excludedPropertyKeys.has(toLower(attribute.key)))
              .map((attribute) => {
                if (isExamFieldKey(attribute.key)) {
                  const isExamEligible = getRecordValueByField(record, attribute.key) === true;
                  if (!isExamEligible || !onOpenExamFromRecord) {
                    return null;
                  }
                  return {
                    key: attribute.key,
                    kind: "action" as const,
                  };
                }
                const value = stringifyMetaValue(
                  attribute.key,
                  getRecordValueByField(record, attribute.key),
                  attribute.type,
                  monitoringProfiles,
                );
                if (!value) {
                  return null;
                }
                return {
                  key: attribute.key,
                  kind: "text" as const,
                  label: attribute.label || attribute.key,
                  value,
                };
              })
              .filter((entry): entry is (
                | { key: string; kind: "text"; label: string; value: string }
                | { key: string; kind: "action" }
              ) => Boolean(entry));
            const rowMetaLeft = hasPlacement && startX !== null
              ? clamp(startX + width + 10, ROW_META_EDGE_PADDING, rowMetaClampMax)
              : 10;

            return (
              <Fragment key={record.fileId}>
                {!isSidebarCollapsed ? (
                  <div className={`database-project-sidebar-row${hasPlacement ? "" : " is-unplaced"}`}>
                    <button
                      type="button"
                      className="database-project-sidebar-row-title"
                      onClick={() => onOpenRecord?.(record)}
                      title={record.relativePath}
                      draggable={editable}
                      onDragStart={(event) => {
                        startInternalDrag(event, {
                          channel: DRAG_CHANNELS.DATABASE_RECORD,
                          payload: record.fileId,
                          plainTextFallback: record.fileId,
                          effectAllowed: "move",
                        });
                      }}
                      onDragEnd={() => {
                        endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
                      }}
                      data-md-block-control="true"
                    >
                      {rowTitle}
                    </button>
                    <span className="database-project-sidebar-row-meta">
                      {hasPlacement ? `Slot ${displayStart} · ${displayUnits}u` : "Unplatziert"}
                    </span>
                  </div>
                ) : null}

                <div
                  className={`database-project-row-track${isPending ? " is-pending" : ""}`}
                  title={entry?.tooltip}
                  onDragOver={(event) => {
                    if (!editable) {
                      return;
                    }
                    event.preventDefault();
                    setDropEffectSafe(event, "move");
                  }}
                  onDrop={(event) => {
                    if (!editable || !onCommitPlacement) {
                      return;
                    }
                    const droppedRecordId = readInternalDragText(event, {
                      channel: DRAG_CHANNELS.DATABASE_RECORD,
                    });
                    const droppedRecord = recordById.get(droppedRecordId);
                    if (!droppedRecord) {
                      endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
                      return;
                    }
                    const existing = entryByRecordId.get(droppedRecordId);
                    const nextUnits = clamp(
                      existing?.units ?? defaultUnits,
                      1,
                      resolution,
                    );
                    const rect = event.currentTarget.getBoundingClientRect();
                    const xInTrack = event.clientX - rect.left;
                    const startSlot = clamp(
                      Math.floor(xInTrack / SLOT_WIDTH),
                      0,
                      Math.max(0, resolution - 1),
                    );
                    onCommitPlacement({
                      record: droppedRecord,
                      startSlot,
                      units: clamp(nextUnits, 1, Math.max(1, resolution - startSlot)),
                    });
                    endInternalDrag(DRAG_CHANNELS.DATABASE_RECORD);
                  }}
                >
                  {hasPlacement ? (
                    <span
                      className={`database-project-bar${barFillRatio === null ? " is-neutral" : ""}`}
                      style={{
                        left: `${startX ?? 0}px`,
                        width: `${width}px`,
                      }}
                      onPointerDown={(event) => {
                        if (event.ctrlKey || event.metaKey) {
                          if (!onChangeBarFillConfig) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          handleOpenBarConfig(record.fileId, event.currentTarget);
                          return;
                        }
                        if (!editable || isPending || displayStart === null || displayUnits === null) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        setInteraction({
                          kind: "move",
                          recordId: record.fileId,
                          originStartSlot: displayStart,
                          originUnits: displayUnits,
                          pointerStartX: event.clientX,
                        });
                      }}
                    >
                      <span
                        className="database-project-bar-fill"
                        aria-hidden="true"
                        style={{ width: `${barFillPercent}%` }}
                      />
                      <span
                        className="database-project-bar-handle is-start"
                        onPointerDown={(event) => {
                          if (event.ctrlKey || event.metaKey) {
                            if (!onChangeBarFillConfig) {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            handleOpenBarConfig(
                              record.fileId,
                              event.currentTarget.parentElement instanceof HTMLElement
                                ? event.currentTarget.parentElement
                                : event.currentTarget,
                            );
                            return;
                          }
                          if (!editable || isPending || displayStart === null || displayUnits === null) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          setInteraction({
                            kind: "resize-start",
                            recordId: record.fileId,
                            originStartSlot: displayStart,
                            originUnits: displayUnits,
                            pointerStartX: event.clientX,
                          });
                        }}
                      />
                      <span
                        className="database-project-bar-handle is-end"
                        onPointerDown={(event) => {
                          if (event.ctrlKey || event.metaKey) {
                            if (!onChangeBarFillConfig) {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            handleOpenBarConfig(
                              record.fileId,
                              event.currentTarget.parentElement instanceof HTMLElement
                                ? event.currentTarget.parentElement
                                : event.currentTarget,
                            );
                            return;
                          }
                          if (!editable || isPending || displayStart === null || displayUnits === null) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          setInteraction({
                            kind: "resize-end",
                            recordId: record.fileId,
                            originStartSlot: displayStart,
                            originUnits: displayUnits,
                            pointerStartX: event.clientX,
                          });
                        }}
                      />
                    </span>
                  ) : null}
                  {propertyRows.length > 0 ? (
                    <div
                      className="database-project-row-meta"
                      style={{ left: `${rowMetaLeft}px` }}
                    >
                      {propertyRows.map((entry) => (
                        <p key={entry.key} className="database-row-meta-item">
                          {entry.kind === "action" ? (
                            <button
                              type="button"
                              className="database-exam-action"
                              onClick={() => onOpenExamFromRecord?.(record)}
                              title="Exam starten"
                              data-md-block-control="true"
                            >
                              Exam
                            </button>
                          ) : (
                            <>
                              <strong>{entry.label}:</strong> {entry.value}
                            </>
                          )}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      <AnchoredPopup
        isOpen={isBarConfigOpen}
        onClose={handleCloseBarConfig}
        anchorRef={configAnchorRef}
        closeLayerId="database-project-bar-config"
        placement="right-start"
        ariaLabel="Project Balken Konfiguration"
        className="database-project-bar-config-popup"
      >
        <section className="database-project-bar-config" data-md-block-control="true">
          <header className="database-project-bar-config-header">
            <h5>Balken verknuepfen</h5>
            <p>{configRecordTitle}</p>
          </header>
          <div className="database-project-bar-config-grid">
            <label>
              Attribut
              <select
                value={configDraft.attributeKey}
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    attributeKey: event.target.value,
                  }))}
              >
                <option value="">Bitte waehlen</option>
                {sortedAttributes.map((attribute) => (
                  <option key={attribute.key} value={attribute.key}>
                    {attribute.label || attribute.key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modus
              <select
                value={configDraft.mode}
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    mode: event.target.value === "text-code" ? "text-code" : "numeric",
                  }))}
              >
                <option value="numeric">Numerisch</option>
                <option value="text-code">Text/Code</option>
              </select>
            </label>
          </div>

          {configDraft.mode === "numeric" ? (
            <div className="database-project-bar-config-grid">
              <label>
                Minimum
                <input
                  type="text"
                  value={configDraft.min}
                  onChange={(event) =>
                    setConfigDraft((current) => ({
                      ...current,
                      min: event.target.value,
                    }))}
                  placeholder="0"
                />
              </label>
              <label>
                Maximum
                <input
                  type="text"
                  value={configDraft.max}
                  onChange={(event) =>
                    setConfigDraft((current) => ({
                      ...current,
                      max: event.target.value,
                    }))}
                  placeholder="100"
                />
              </label>
            </div>
          ) : (
            <div className="database-project-bar-config-mappings">
              <div className="database-project-bar-config-mapping-head">
                <span>Quelle</span>
                <span>Ziel %</span>
              </div>
              {configDraft.mappings.map((mapping, index) => (
                <div key={`mapping-${index}`} className="database-project-bar-config-mapping-row">
                  <input
                    type="text"
                    value={mapping.from}
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        mappings: current.mappings.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, from: event.target.value }
                            : entry),
                      }))}
                    placeholder="text1"
                  />
                  <input
                    type="text"
                    value={mapping.to}
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        mappings: current.mappings.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, to: event.target.value }
                            : entry),
                      }))}
                    placeholder="10"
                  />
                  <button
                    type="button"
                    className="database-block-toolbar-button"
                    onClick={() =>
                      setConfigDraft((current) => ({
                        ...current,
                        mappings: current.mappings.length <= 1
                          ? current.mappings
                          : current.mappings.filter((_, entryIndex) => entryIndex !== index),
                      }))}
                    aria-label="Zuordnung entfernen"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="database-block-toolbar-button"
                onClick={() =>
                  setConfigDraft((current) => ({
                    ...current,
                    mappings: [
                      ...current.mappings,
                      {
                        from: "",
                        to: "",
                      },
                    ],
                  }))}
              >
                Zuordnung hinzufuegen
              </button>
            </div>
          )}

          <footer className="database-project-bar-config-actions">
            {onApplyBarFillConfigToVisible ? (
              <button
                type="button"
                className="database-block-toolbar-button"
                onClick={() => void handleApplyBarConfigToVisible()}
                disabled={!configDraft.attributeKey.trim() || visibleRecords.length === 0 || isApplyingBarRule}
              >
                Regel auf sichtbare anwenden
              </button>
            ) : null}
            <button
              type="button"
              className="database-block-toolbar-button"
              onClick={handleRemoveBarConfig}
              disabled={isApplyingBarRule}
            >
              Verknuepfung entfernen
            </button>
            <button
              type="button"
              className="database-block-toolbar-button"
              onClick={handleCloseBarConfig}
              disabled={isApplyingBarRule}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="database-block-toolbar-button"
              onClick={handleSaveBarConfig}
              disabled={!configDraft.attributeKey.trim() || isApplyingBarRule}
            >
              Speichern
            </button>
          </footer>
        </section>
      </AnchoredPopup>
    </div>
  );
};
