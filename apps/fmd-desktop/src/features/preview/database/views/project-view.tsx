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
  type DatabaseProjectMissingPlacement,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "../database-types";
import {
  formatMonitoringCompactText,
  renderMonitoringValue,
  type MonitoringRenderProfile,
} from "../../../monitoring/monitoring-render-rules";

type DatabaseProjectViewProps = {
  records: DatabaseRecord[];
  startField: string;
  unitField: string;
  resolution: number;
  defaultUnits: number;
  missingPlacement: DatabaseProjectMissingPlacement;
  visibleProperties: DatabaseAttributeMeta[];
  monitoringProfiles?: MonitoringRenderProfile[];
  editable?: boolean;
  pendingRecordIds?: string[];
  onOpenRecord?: (record: DatabaseRecord) => void;
  onOpenExamFromRecord?: (record: DatabaseRecord) => void;
  onCommitPlacement?: (params: {
    record: DatabaseRecord;
    startSlot: number;
    units: number;
  }) => void;
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

const toNumericValue = (value: DatabaseNormalizedFieldValue): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const objectValue = value as {
      value?: unknown;
      ratio?: unknown;
    };
    if (typeof objectValue.value === "number" && Number.isFinite(objectValue.value)) {
      return objectValue.value;
    }
    if (typeof objectValue.ratio === "number" && Number.isFinite(objectValue.ratio)) {
      return objectValue.ratio;
    }
  }
  return null;
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
  startField,
  unitField,
  resolution,
  defaultUnits,
  missingPlacement,
  visibleProperties,
  monitoringProfiles = [],
  editable = false,
  pendingRecordIds = [],
  onOpenRecord,
  onOpenExamFromRecord,
  onCommitPlacement,
}: DatabaseProjectViewProps) => {
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [draftByRecordId, setDraftByRecordId] = useState<Record<string, { startSlot: number; units: number }>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1200 : false,
  );
  const gridScrollRef = useRef<HTMLDivElement | null>(null);

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
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", record.fileId);
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
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    if (!editable || !onCommitPlacement) {
                      return;
                    }
                    const droppedRecordId = event.dataTransfer.getData("text/plain");
                    const droppedRecord = recordById.get(droppedRecordId);
                    if (!droppedRecord) {
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
                  }}
                >
                  {hasPlacement ? (
                    <span
                      className="database-project-bar"
                      style={{
                        left: `${startX ?? 0}px`,
                        width: `${width}px`,
                      }}
                      onPointerDown={(event) => {
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
                        className="database-project-bar-handle is-start"
                        onPointerDown={(event) => {
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
    </div>
  );
};
