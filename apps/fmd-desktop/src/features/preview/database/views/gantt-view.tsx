/**
 * @file apps/fmd-desktop/src/features/preview/database/views/gantt-view.tsx
 *
 * Phase-1 placeholder for timeline/gantt visualization.
 */

import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
} from "../database-types";

type DatabaseGanttViewProps = {
  records: DatabaseRecord[];
  startAttribute: DatabaseAttributeMeta | null;
  endAttribute: DatabaseAttributeMeta | null;
};

export const DatabaseGanttView = ({
  records,
  startAttribute,
  endAttribute,
}: DatabaseGanttViewProps) => {
  if (!startAttribute || !startAttribute.viewCompatibility.supportsTimeline) {
    return (
      <div className="database-view-empty">
        Waehle ein Start-Datum fuer Timeline/Gantt.
      </div>
    );
  }

  if (endAttribute && !endAttribute.viewCompatibility.supportsTimeline) {
    return (
      <div className="database-view-empty">
        End-/Due-Feld muss ein Datumsfeld sein.
      </div>
    );
  }

  return (
    <div className="database-view-empty">
      Timeline/Gantt wird in Phase 3 aktiviert. Datensaetze: {records.length}
    </div>
  );
};
