/**
 * @file apps/fmd-desktop/src/features/preview/attribute-type-catalog.ts
 *
 * Shared attribute-type catalog used by frontmatter and database add flows.
 */

import { type DatabaseFieldType } from "./database/database-types";

export type SharedPropertyIcon =
  | "text"
  | "task"
  | "time"
  | "number"
  | "boolean"
  | "tags"
  | "link"
  | "cover"
  | "formula"
  | "unknown";

export type CoreAttributeTypeId =
  "text" | "task" | "time" | "link" | "number" | "cover" | "tags" | "formula";

export type CoreAttributeTypeOption = {
  id: CoreAttributeTypeId;
  label: string;
  description: string;
  icon: SharedPropertyIcon;
};

export const CORE_ATTRIBUTE_TYPE_OPTIONS: CoreAttributeTypeOption[] = [
  {
    id: "text",
    icon: "text",
    label: "Text",
    description: "Freier Text",
  },
  {
    id: "task",
    icon: "task",
    label: "Task",
    description: "Points-Profil Zuordnung",
  },
  {
    id: "time",
    icon: "time",
    label: "Zeit",
    description: "Datum, Uhrzeit oder Datum+Uhrzeit",
  },
  {
    id: "link",
    icon: "link",
    label: "Links",
    description: "Wikilink oder Name",
  },
  {
    id: "number",
    icon: "number",
    label: "Zahlen",
    description: "Numerische Werte",
  },
  {
    id: "cover",
    icon: "cover",
    label: "Cover",
    description: "Bild-Wikilink",
  },
  {
    id: "tags",
    icon: "tags",
    label: "Tags",
    description: "Tag-Liste",
  },
  {
    id: "formula",
    icon: "formula",
    label: "Formel",
    description: "Aggregationen und Auswertungen",
  },
];

export const FRONTMATTER_DEFAULT_CORE_TYPE: CoreAttributeTypeId = "text";

export const resolveAutoAttributeKeyForCoreType = (id: CoreAttributeTypeId) => {
  if (id === "task") {
    return "Task";
  }
  if (id === "link") {
    return "links";
  }
  if (id === "tags") {
    return "tags";
  }
  if (id === "cover") {
    return "Cover";
  }
  return null;
};

export const mapCoreTypeToDatabaseFieldType = (id: CoreAttributeTypeId): DatabaseFieldType => {
  switch (id) {
    case "time":
      return "time";
    case "link":
      return "link";
    case "number":
      return "number";
    case "cover":
      return "image";
    case "tags":
      return "tags";
    case "formula":
      return "formula";
    case "task":
    case "text":
    default:
      return "text";
  }
};

export const resolveDatabaseFieldTypeIcon = (type: DatabaseFieldType): SharedPropertyIcon => {
  switch (type) {
    case "number":
    case "unit":
    case "percent":
    case "score":
    case "rating":
    case "progress":
      return "number";
    case "date":
    case "time":
    case "datetime":
    case "duration":
      return "time";
    case "tags":
    case "multiselect":
    case "select":
    case "status":
      return "tags";
    case "boolean":
      return "boolean";
    case "link":
    case "relation":
    case "file":
      return "link";
    case "image":
      return "cover";
    case "formula":
      return "formula";
    default:
      return "text";
  }
};

export const resolveDatabaseFieldTypeLabel = (type: DatabaseFieldType) => {
  const fromCore = CORE_ATTRIBUTE_TYPE_OPTIONS.find(
    (option) => mapCoreTypeToDatabaseFieldType(option.id) === type,
  );
  if (fromCore) {
    return fromCore.label;
  }
  const fromExtended = DATABASE_EXTENDED_TYPE_OPTIONS.find((option) => option.fieldType === type);
  return fromExtended?.label ?? type;
};

export type DatabaseExtendedTypeOption = {
  fieldType: DatabaseFieldType;
  label: string;
  icon: SharedPropertyIcon;
};

export const DATABASE_EXTENDED_TYPE_OPTIONS: DatabaseExtendedTypeOption[] = [
  { fieldType: "longtext", label: "Langer Text", icon: "text" },
  { fieldType: "unit", label: "Einheit", icon: "number" },
  { fieldType: "percent", label: "Prozent", icon: "number" },
  { fieldType: "boolean", label: "Boolean", icon: "boolean" },
  { fieldType: "date", label: "Datum", icon: "time" },
  { fieldType: "datetime", label: "Datum+Zeit", icon: "time" },
  { fieldType: "select", label: "Auswahl", icon: "tags" },
  { fieldType: "multiselect", label: "Mehrfachauswahl", icon: "tags" },
  { fieldType: "file", label: "Datei", icon: "link" },
  { fieldType: "status", label: "Status", icon: "tags" },
  { fieldType: "rating", label: "Bewertung", icon: "number" },
  { fieldType: "relation", label: "Relation", icon: "link" },
  { fieldType: "duration", label: "Dauer", icon: "time" },
  { fieldType: "progress", label: "Fortschritt", icon: "number" },
  { fieldType: "score", label: "Score", icon: "number" },
];

export const DATABASE_CREATE_CORE_DEFAULT: CoreAttributeTypeId = "text";
