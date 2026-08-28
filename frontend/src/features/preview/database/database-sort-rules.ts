/**
 * @file frontend/src/features/preview/database/database-sort-rules.ts
 *
 * Header-sort rule helpers for database table interactions.
 */

import { type DatabaseSortRule } from "./database-types";

const toLower = (value: string) => value.trim().toLowerCase();

const createSortRuleId = () => `sort-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Toggles a sort rule by field with priority semantics used by table-header clicks:
 * - missing -> asc (insert at index 0)
 * - asc -> desc (move to index 0)
 * - desc -> remove
 */
export const toggleDatabaseSortRuleByField = (
  sortRules: DatabaseSortRule[],
  fieldKey: string,
): DatabaseSortRule[] => {
  const normalizedFieldKey = toLower(fieldKey);
  if (!normalizedFieldKey) {
    return sortRules;
  }

  const existingIndex = sortRules.findIndex((rule) => toLower(rule.field) === normalizedFieldKey);
  const rulesWithoutField = sortRules.filter((rule) => toLower(rule.field) !== normalizedFieldKey);
  if (existingIndex < 0) {
    return [
      {
        id: createSortRuleId(),
        field: fieldKey,
        dir: "asc",
        nulls: "last",
        natural: true,
      },
      ...rulesWithoutField,
    ];
  }

  const existingRule = sortRules[existingIndex];
  if (!existingRule) {
    return sortRules;
  }

  if (existingRule.dir === "desc") {
    return rulesWithoutField;
  }

  const nextRule: DatabaseSortRule = {
    ...existingRule,
    field: fieldKey,
    dir: "desc",
  };
  return [
    nextRule,
    ...rulesWithoutField,
  ];
};
