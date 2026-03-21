/**
 * @file apps/fmd-desktop/src/features/preview/database/views/pie-view.tsx
 *
 * Phase-1 pie/donut placeholder with grouped counts.
 */

import { useMemo } from "react";
import {
  type DatabaseAttributeMeta,
  type DatabaseRecord,
} from "../database-types";

type DatabasePieViewProps = {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
};

const getRecordValueByField = (record: DatabaseRecord, field: string) => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = field.trim().toLowerCase();
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => key.trim().toLowerCase() === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

export const DatabasePieView = ({
  records,
  groupAttribute,
}: DatabasePieViewProps) => {
  const buckets = useMemo(() => {
    if (!groupAttribute) {
      return [];
    }
    const counts = new Map<string, number>();
    records.forEach((record) => {
      const rawValue = getRecordValueByField(record, groupAttribute.key);
      const label = Array.isArray(rawValue)
        ? rawValue.join(", ") || "(leer)"
        : String(rawValue ?? "(leer)");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count);
  }, [groupAttribute, records]);

  if (!groupAttribute || !groupAttribute.viewCompatibility.supportsPieGrouping) {
    return (
      <div className="database-view-empty">
        Waehle ein gruppierbares Feld fuer Pie/Donut.
      </div>
    );
  }

  return (
    <div className="database-pie-placeholder">
      <p className="database-pie-title">{`Verteilung nach ${groupAttribute.label}`}</p>
      <ul className="database-pie-list">
        {buckets.map((bucket) => (
          <li key={bucket.label}>
            <span>{bucket.label}</span>
            <strong>{bucket.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};
