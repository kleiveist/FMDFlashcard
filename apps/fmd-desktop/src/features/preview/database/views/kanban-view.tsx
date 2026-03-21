/**
 * @file apps/fmd-desktop/src/features/preview/database/views/kanban-view.tsx
 *
 * Phase-1 placeholder for kanban visualization.
 */

import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
} from "../database-types";

type DatabaseKanbanViewProps = {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
};

export const DatabaseKanbanView = ({
  records,
  groupAttribute,
}: DatabaseKanbanViewProps) => {
  if (!groupAttribute || !groupAttribute.viewCompatibility.supportsKanbanGrouping) {
    return (
      <div className="database-view-empty">
        Waehle ein Status-/Select-/Kategoriefeld fuer Kanban.
      </div>
    );
  }

  return (
    <div className="database-view-empty">
      Kanban wird in Phase 2 aktiviert. Datensaetze: {records.length}
    </div>
  );
};
