/**
 * @file apps/fmd-desktop/src/features/preview/database/views/project-view.tsx
 *
 * Editable block-based project visualization for database records.
 */

import {
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

type DatabaseProjectViewProps = {
  records: DatabaseRecord[];
  startField: string;
  unitField: string;
  resolution: number;
  defaultUnits: number;
  missingPlacement: DatabaseProjectMissingPlacement;
  visibleProperties: DatabaseAttributeMeta[];
  editable?: boolean;
  pendingRecordIds?: string[];
  onOpenRecord?: (record: DatabaseRecord) => void;
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

const toLower = (value: string) => value.trim().toLowerCase();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
    if ("value" in value && typeof value.value === "number" && Number.isFinite(value.value)) {
      return value.value;
    }
    if ("ratio" in value && typeof value.ratio === "number" && Number.isFinite(value.ratio)) {
      return value.ratio;
    }
  }
  return null;
};

const stringifyMetaValue = (
  value: DatabaseNormalizedFieldValue,
  type: DatabaseAttributeMeta["type"],
): string | null => {
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
    if ("raw" in value) {
      const raw = String(value.raw ?? "").trim();
      return raw || null;
    }
    if ("value" in value && typeof value.value === "number" && Number.isFinite(value.value)) {
      return String(value.value);
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
  editable = false,
  pendingRecordIds = [],
  onOpenRecord,
  onCommitPlacement,
}: DatabaseProjectViewProps) => {
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [draftByRecordId, setDraftByRecordId] = useState<Record<string, { startSlot: number; units: number }>>({});
  const [isNarrowLayout, setIsNarrowLayout] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1200 : false,
  );
  const [isSidebarOverlayOpen, setIsSidebarOverlayOpen] = useState(false);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const narrow = window.innerWidth < 1200;
      setIsNarrowLayout(narrow);
      if (!narrow) {
        setIsSidebarOverlayOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
  const gridTemplateColumns = isNarrowLayout
    ? `${totalWidth}px`
    : `${SIDEBAR_WIDTH}px ${totalWidth}px`;

  return (
    <div className={`database-project-view${isNarrowLayout ? " is-narrow" : ""}`}>
      {isNarrowLayout ? (
        <div className="database-project-mobile-controls">
          <button
            type="button"
            className="database-block-toolbar-button"
            onClick={() => setIsSidebarOverlayOpen((current) => !current)}
            data-md-block-control="true"
          >
            {isSidebarOverlayOpen ? "Liste ausblenden" : "Liste anzeigen"}
          </button>
        </div>
      ) : null}

      <div className="database-project-grid-scroll" ref={gridScrollRef}>
        <div
          className="database-project-grid"
          style={{
            gridTemplateColumns,
          }}
        >
          {!isNarrowLayout ? (
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
                const value = stringifyMetaValue(
                  getRecordValueByField(record, attribute.key),
                  attribute.type,
                );
                if (!value) {
                  return null;
                }
                return {
                  key: attribute.key,
                  label: attribute.label || attribute.key,
                  value,
                };
              })
              .filter((entry): entry is { key: string; label: string; value: string } => Boolean(entry));
            const rowMetaLeft = hasPlacement && startX !== null
              ? clamp(startX + width + 10, 8, Math.max(8, resolution * SLOT_WIDTH - 200))
              : 10;

            return (
              <Fragment key={record.fileId}>
                {!isNarrowLayout ? (
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
                  ) : missingPlacement === "show-unplaced" ? (
                    <span className="database-project-unplaced-hint">Nicht platziert</span>
                  ) : null}
                  {propertyRows.length > 0 ? (
                    <div
                      className="database-project-row-meta"
                      style={{ left: `${rowMetaLeft}px` }}
                    >
                      {propertyRows.map((entry) => (
                        <p key={entry.key}>
                          <strong>{entry.label}:</strong> {entry.value}
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

      {isNarrowLayout && isSidebarOverlayOpen ? (
        <aside className="database-project-sidebar-overlay" data-md-block-control="true">
          <header>
            <h6>Dateien</h6>
            <button
              type="button"
              className="database-block-panel-close"
              onClick={() => setIsSidebarOverlayOpen(false)}
              aria-label="Liste schliessen"
            >
              ×
            </button>
          </header>
          <div className="database-project-sidebar-overlay-list">
            {visibleRecords.map((record) => {
              const entry = entryByRecordId.get(record.fileId);
              return (
                <button
                  key={record.fileId}
                  type="button"
                  className={`database-project-sidebar-overlay-row${entry ? "" : " is-unplaced"}`}
                  title={record.relativePath}
                  draggable={editable}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", record.fileId);
                  }}
                  onClick={() => onOpenRecord?.(record)}
                >
                  <span>{getRowTitle(record)}</span>
                  <span>{entry ? `Slot ${entry.startSlot} · ${entry.units}u` : "Unplatziert"}</span>
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}
    </div>
  );
};
