/**
 * @file apps/fmd-desktop/src/features/preview/formula/formula-attribute-builder.tsx
 *
 * Shared builder UI for structured aggregation formulas.
 */

import { useEffect, useMemo } from "react";
import {
  type DatabaseFormulaDefinitionV1,
  type DatabaseFormulaOperation,
  type DatabaseFormulaSourceType,
} from "./database-formula-types";

export type FormulaBuilderAttributeOption = {
  key: string;
  label: string;
  supportsMath: boolean;
};

type FormulaAttributeBuilderProps = {
  value: DatabaseFormulaDefinitionV1;
  attributes: FormulaBuilderAttributeOption[];
  disabled?: boolean;
  idPrefix?: string;
  showOperationField?: boolean;
  showSourceTypeField?: boolean;
  folderSuggestions?: string[];
  onChange: (
    next:
      | DatabaseFormulaDefinitionV1
      | ((current: DatabaseFormulaDefinitionV1) => DatabaseFormulaDefinitionV1)
  ) => void;
};

const OPERATION_LABELS: Record<DatabaseFormulaOperation, string> = {
  avg: "Durchschnitt",
  sum: "Summe",
  count: "Anzahl",
  group_count: "Gruppieren und Zaehlen",
};

const SOURCE_LABELS: Record<DatabaseFormulaSourceType, string> = {
  "current-folder": "Aktueller Ordner",
  "explicit-folder": "Ein Ordner",
  "multi-folder": "Mehrere Ordner",
};

const toLower = (value: string) => value.trim().toLowerCase();

const dedupeKeys = (keys: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  keys.forEach((key) => {
    const trimmed = key.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(trimmed);
  });
  return next;
};

const hasCaseInsensitiveKey = (keys: string[], candidate: string) => {
  const normalizedCandidate = toLower(candidate);
  return keys.some((key) => toLower(key) === normalizedCandidate);
};

const toggleCaseInsensitiveKey = (keys: string[], candidate: string) => {
  const normalizedCandidate = toLower(candidate);
  const existing = dedupeKeys(keys);
  if (existing.some((key) => toLower(key) === normalizedCandidate)) {
    return existing.filter((key) => toLower(key) !== normalizedCandidate);
  }
  return [...existing, candidate];
};

const formatFolderLabel = (folder: string) => folder.trim() === "" ? "Root" : folder;

export const FormulaAttributeBuilder = ({
  value,
  attributes,
  disabled = false,
  idPrefix = "formula-builder",
  showOperationField = true,
  showSourceTypeField = true,
  folderSuggestions,
  onChange,
}: FormulaAttributeBuilderProps) => {
  const emitChange = (resolveNext: (current: DatabaseFormulaDefinitionV1) => DatabaseFormulaDefinitionV1) => {
    onChange((current) => resolveNext(current));
  };

  const supportsMathByKey = useMemo(() => {
    const map = new Map<string, boolean>();
    attributes.forEach((attribute) => {
      map.set(attribute.key.trim().toLowerCase(), attribute.supportsMath);
    });
    return map;
  }, [attributes]);

  const selectedKeys = value.attributeKeys;
  const hasMathCapableSelection = selectedKeys.some((key) =>
    supportsMathByKey.get(key.trim().toLowerCase()) === true);
  const normalizedFolderSuggestions = useMemo(
    () =>
      dedupeKeys((folderSuggestions ?? [])
        .map((folder) => folder.trim())
        .filter((folder) => folder.length > 0)),
    [folderSuggestions],
  );

  const availableOperations = hasMathCapableSelection
    ? (["avg", "sum", "count", "group_count"] as DatabaseFormulaOperation[])
    : (["count", "group_count"] as DatabaseFormulaOperation[]);

  useEffect(() => {
    if (availableOperations.includes(value.operation)) {
      return;
    }
    onChange((current) => ({
      ...current,
      operation: "count",
    }));
  }, [availableOperations, onChange, value.operation]);

  const handleToggleAttribute = (key: string) => {
    emitChange((current) => ({
      ...current,
      attributeKeys: dedupeKeys(toggleCaseInsensitiveKey(current.attributeKeys, key)),
    }));
  };

  const handleOperationChange = (nextOperation: DatabaseFormulaOperation) => {
    emitChange((current) => ({
      ...current,
      operation: nextOperation,
    }));
  };

  const handleSourceTypeChange = (nextType: DatabaseFormulaSourceType) => {
    emitChange((current) => {
      const nextSource = {
        type: nextType,
      } as DatabaseFormulaDefinitionV1["source"];
      if (nextType === "explicit-folder") {
        nextSource.path = current.source.path?.trim() ?? "";
      }
      if (nextType === "multi-folder") {
        nextSource.paths = current.source.type === "multi-folder"
          ? dedupeKeys(current.source.paths ?? [])
          : [];
      }
      return {
        ...current,
        source: nextSource,
      };
    });
  };

  const handleExplicitFolderChange = (nextPath: string) => {
    emitChange((current) => ({
      ...current,
      source: {
        type: "explicit-folder",
        path: nextPath,
      },
    }));
  };

  const handleMultiFolderChange = (nextValue: string) => {
    const paths = nextValue
      .split(",")
      .map((path) => path.trim())
      .filter((path) => path.length > 0);
    emitChange((current) => ({
      ...current,
      source: {
        type: "multi-folder",
        paths: dedupeKeys(paths),
      },
    }));
  };

  const handleToggleMultiFolder = (path: string) => {
    emitChange((current) => ({
      ...current,
      source: {
        type: "multi-folder",
        paths: toggleCaseInsensitiveKey(
          current.source.type === "multi-folder" ? current.source.paths ?? [] : [],
          path,
        ),
      },
    }));
  };

  const explicitSourcePath = value.source.type === "explicit-folder"
    ? value.source.path?.trim() ?? ""
    : "";
  const multiSourcePaths = value.source.type === "multi-folder"
    ? dedupeKeys(value.source.paths ?? [])
    : [];
  const hasFolderSuggestions = normalizedFolderSuggestions.length > 0;

  return (
    <div className="formula-attribute-builder">
      <div className="formula-attribute-builder-field">
        <span id={`${idPrefix}-attributes-label`}>Attribute</span>
        {attributes.length > 0 ? (
          <ul
            className="formula-attribute-builder-option-list"
            data-formula-builder-scope="attributes"
            role="group"
            aria-labelledby={`${idPrefix}-attributes-label`}
          >
            {attributes.map((attribute) => {
              const selected = hasCaseInsensitiveKey(selectedKeys, attribute.key);
              return (
                <li key={attribute.key}>
                  <button
                    type="button"
                    className={`formula-attribute-builder-option${selected ? " is-selected" : ""}`}
                    role="checkbox"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => handleToggleAttribute(attribute.key)}
                  >
                    <span className="formula-attribute-builder-option-check" aria-hidden="true">
                      {selected ? "✓" : ""}
                    </span>
                    <span className="formula-attribute-builder-option-copy">{attribute.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="formula-attribute-builder-empty">Keine Attribute verfügbar.</p>
        )}
      </div>

      {showOperationField ? (
        <label className="formula-attribute-builder-field">
          <span>Operation</span>
          <select
            value={value.operation}
            disabled={disabled}
            onChange={(event) => handleOperationChange(event.target.value as DatabaseFormulaOperation)}
          >
            {availableOperations.map((operation) => (
              <option key={operation} value={operation}>
                {OPERATION_LABELS[operation]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showSourceTypeField ? (
        <label className="formula-attribute-builder-field">
          <span>Quelle</span>
          <select
            value={value.source.type}
            disabled={disabled}
            onChange={(event) => handleSourceTypeChange(event.target.value as DatabaseFormulaSourceType)}
          >
            {(Object.keys(SOURCE_LABELS) as DatabaseFormulaSourceType[]).map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {SOURCE_LABELS[sourceType]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {value.source.type === "explicit-folder" ? (
        <div className="formula-attribute-builder-field">
          <span id={`${idPrefix}-explicit-folder-label`}>Ordner</span>
          {hasFolderSuggestions ? (
            <ul
              className="formula-attribute-builder-option-list"
              data-formula-builder-scope="explicit-folder"
              role="radiogroup"
              aria-labelledby={`${idPrefix}-explicit-folder-label`}
            >
              {normalizedFolderSuggestions.map((folder) => {
                const selected = toLower(explicitSourcePath) === toLower(folder);
                return (
                  <li key={folder}>
                    <button
                      type="button"
                      className={`formula-attribute-builder-option${selected ? " is-selected" : ""}`}
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => handleExplicitFolderChange(folder)}
                    >
                      <span className="formula-attribute-builder-option-check" aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>
                      <span className="formula-attribute-builder-option-copy">{formatFolderLabel(folder)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <input
            type="text"
            value={value.source.path ?? ""}
            disabled={disabled}
            onChange={(event) => handleExplicitFolderChange(event.target.value)}
            placeholder="z.B. Projekte/Sprint"
          />
        </div>
      ) : null}

      {value.source.type === "multi-folder" ? (
        <div className="formula-attribute-builder-field">
          <span id={`${idPrefix}-multi-folder-label`}>Ordner</span>
          {hasFolderSuggestions ? (
            <ul
              className="formula-attribute-builder-option-list"
              data-formula-builder-scope="multi-folder"
              role="group"
              aria-labelledby={`${idPrefix}-multi-folder-label`}
            >
              {normalizedFolderSuggestions.map((folder) => {
                const selected = hasCaseInsensitiveKey(multiSourcePaths, folder);
                return (
                  <li key={folder}>
                    <button
                      type="button"
                      className={`formula-attribute-builder-option${selected ? " is-selected" : ""}`}
                      role="checkbox"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => handleToggleMultiFolder(folder)}
                    >
                      <span className="formula-attribute-builder-option-check" aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>
                      <span className="formula-attribute-builder-option-copy">{formatFolderLabel(folder)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <span>{hasFolderSuggestions ? "Weitere Ordner (kommagetrennt, optional)" : "Ordner (kommagetrennt)"}</span>
          <input
            type="text"
            value={(value.source.paths ?? []).join(", ")}
            disabled={disabled}
            onChange={(event) => handleMultiFolderChange(event.target.value)}
            placeholder="z.B. Projekte, Archiv/2026"
          />
        </div>
      ) : null}

      <p className="formula-attribute-builder-hint">
        Kurztext-Regel: max {value.shortTextRule.maxChars} Zeichen, max {value.shortTextRule.maxTokens} Tokens,
        genau ein Zahlenkern.
      </p>
    </div>
  );
};
