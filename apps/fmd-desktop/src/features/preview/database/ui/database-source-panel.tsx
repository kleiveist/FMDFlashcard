/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-source-panel.tsx
 *
 * Source configuration panel for database block.
 */

import { useMemo, useState } from "react";
import { type DatabaseSourceSpec, type DatabaseSourceType } from "../database-types";

type DatabaseSourcePanelProps = {
  source: DatabaseSourceSpec;
  availableFolders: string[];
  historyFolderPath?: string | null;
  onChange: (next: DatabaseSourceSpec) => void;
  onClose: () => void;
};

const sourceTypeOptions: Array<{ value: DatabaseSourceType; label: string }> = [
  { value: "current-folder", label: "Aktueller Ordner" },
  { value: "explicit-folder", label: "Ein Ordner" },
  { value: "multi-folder", label: "Mehrere Ordner" },
  { value: "history-folder", label: "History" },
  { value: "tag-query", label: "Tag Query (Stub)" },
  { value: "manual-query", label: "Manual Query (Stub)" },
];

const rootFolderOption = "";

const dedupeFoldersCaseInsensitive = (paths: string[]) => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  paths.forEach((path) => {
    const normalized = path.trim().toLowerCase();
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    ordered.push(path);
  });
  return ordered;
};

const buildMultiFolderSource = (paths: string[], includeHistory: boolean): DatabaseSourceSpec => ({
  type: "multi-folder",
  paths,
  ...(includeHistory ? { includeHistory: true } : {}),
});

const buildNextSourceForType = (
  type: DatabaseSourceType,
  availableFolders: string[],
): DatabaseSourceSpec => {
  if (type === "explicit-folder") {
    return {
      type,
      path: availableFolders[0] ?? rootFolderOption,
    };
  }
  if (type === "multi-folder") {
    return buildMultiFolderSource([], false);
  }
  if (type === "history-folder") {
    return {
      type,
    };
  }
  if (type === "tag-query") {
    return {
      type,
      tags: [],
    };
  }
  if (type === "manual-query") {
    return {
      type,
      query: "",
    };
  }
  return { type };
};

export const DatabaseSourcePanel = ({
  source,
  availableFolders,
  historyFolderPath = null,
  onChange,
  onClose,
}: DatabaseSourcePanelProps) => {
  const [query, setQuery] = useState("");

  const folderOptions = useMemo(() => {
    const dedupe = new Set<string>();
    const ordered = [rootFolderOption, ...availableFolders].filter((folder) => {
      const normalized = folder.trim().toLowerCase();
      if (dedupe.has(normalized)) {
        return false;
      }
      dedupe.add(normalized);
      return true;
    });

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return ordered;
    }
    return ordered.filter((folder) =>
      folder === rootFolderOption
        ? "vault root".includes(normalizedQuery)
        : folder.toLowerCase().includes(normalizedQuery),
    );
  }, [availableFolders, query]);

  const selectedMulti = new Set((source.paths ?? []).map((path) => path.toLowerCase()));
  const includeHistoryInMulti = source.type === "multi-folder" && source.includeHistory === true;

  return (
    <aside
      className="database-block-panel database-block-source-panel"
      data-md-block-control="true"
      role="dialog"
      aria-label="Database Quelle"
    >
      <header className="database-block-panel-header">
        <h5>Quelle</h5>
        <button
          type="button"
          className="database-block-panel-close"
          onClick={onClose}
          aria-label="Schliessen"
        >
          ×
        </button>
      </header>

      <div className="database-block-panel-controls">
        <label>
          Typ
          <select
            value={source.type}
            onChange={(event) => {
              const nextType = event.target.value as DatabaseSourceType;
              onChange(buildNextSourceForType(nextType, availableFolders));
            }}
          >
            {sourceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {source.type === "explicit-folder" || source.type === "multi-folder" ? (
        <div className="database-block-panel-controls">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ordner suchen"
          />
        </div>
      ) : null}

      {source.type === "explicit-folder" ? (
        <div className="database-block-source-list">
          {folderOptions.map((folder) => (
            <label key={folder || "__root"} className="database-block-source-item">
              <input
                type="radio"
                checked={(source.path ?? rootFolderOption) === folder}
                onChange={() => onChange({ type: "explicit-folder", path: folder })}
              />
              <span>{folder || "(Vault Root)"}</span>
            </label>
          ))}
        </div>
      ) : null}

      {source.type === "multi-folder" ? (
        <div className="database-block-source-list">
          {folderOptions.map((folder) => {
            const checked = selectedMulti.has(folder.toLowerCase());
            const nextPaths = source.paths ?? [];
            const includeHistory = source.includeHistory === true;
            return (
              <label key={folder || "__root"} className="database-block-source-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const updated = event.target.checked
                      ? [...nextPaths, folder]
                      : nextPaths.filter((entry) => entry.toLowerCase() !== folder.toLowerCase());
                    onChange(
                      buildMultiFolderSource(dedupeFoldersCaseInsensitive(updated), includeHistory),
                    );
                  }}
                />
                <span>{folder || "(Vault Root)"}</span>
              </label>
            );
          })}
          <label className="database-block-source-item">
            <input
              type="checkbox"
              checked={includeHistoryInMulti}
              onChange={(event) =>
                onChange(
                  buildMultiFolderSource(
                    dedupeFoldersCaseInsensitive(source.paths ?? []),
                    event.target.checked,
                  ),
                )
              }
            />
            <span>History (Exam-Runs)</span>
          </label>
        </div>
      ) : null}

      {source.type === "multi-folder" && source.includeHistory === true ? (
        <>
          <p className="database-block-state">
            History verwendet die Exam-Runs des aktuellen Vaults.
          </p>
          <p className="database-block-state">Quelle: {historyFolderPath ?? "nicht gesetzt"}</p>
          {!historyFolderPath ? (
            <p className="database-block-state is-error">Kein Vault-Pfad gefunden.</p>
          ) : null}
        </>
      ) : null}

      {source.type === "tag-query" ? (
        <p className="database-block-state">
          Tag Query wird in dieser Phase nur als Stub validiert.
        </p>
      ) : null}
      {source.type === "manual-query" ? (
        <p className="database-block-state">
          Manual Query wird in dieser Phase nur als Stub validiert.
        </p>
      ) : null}
      {source.type === "history-folder" ? (
        <>
          <p className="database-block-state">
            History verwendet die Exam-Runs des aktuellen Vaults.
          </p>
          <p className="database-block-state">Quelle: {historyFolderPath ?? "nicht gesetzt"}</p>
          {!historyFolderPath ? (
            <p className="database-block-state is-error">Kein Vault-Pfad gefunden.</p>
          ) : null}
        </>
      ) : null}
    </aside>
  );
};
