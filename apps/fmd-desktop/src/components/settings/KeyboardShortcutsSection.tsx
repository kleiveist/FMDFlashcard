/**
 * @file apps/fmd-desktop/src/components/settings/KeyboardShortcutsSection.tsx
 *
 * Zweck:
 * - Rendert die Keyboard Shortcuts Settings Seite.
 *
 * Verantwortlichkeiten:
 * - Auflisten, Filtern und Rebinding von Shortcuts.
 * - Konflikte erkennen und Speichern blockieren.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  detectShortcutConflicts,
  eventToBinding,
  formatBinding,
  getDefaultBinding,
  getEffectiveBinding,
  getShortcutPlatform,
  normalizeBinding,
  type KeyboardShortcutSettings,
} from "../../lib/shortcuts/bindings";
import {
  SHORTCUT_COMMANDS,
  SHORTCUT_CONTEXTS,
  type ShortcutCommand,
  type ShortcutContextId,
} from "../../lib/shortcuts/registry";

type KeyboardShortcutsSectionProps = {
  keyboardShortcuts: KeyboardShortcutSettings;
  setKeyboardShortcuts: (settings: KeyboardShortcutSettings) => void;
};

const buildRowId = (commandId: string) =>
  `shortcut-row-${commandId.replace(/[^a-z0-9_-]/gi, "-")}`;

const areBindingsEqual = (
  left: KeyboardShortcutSettings["bindings"],
  right: KeyboardShortcutSettings["bindings"],
) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
};

export const KeyboardShortcutsSection = ({
  keyboardShortcuts,
  setKeyboardShortcuts,
}: KeyboardShortcutsSectionProps) => {
  const platform = getShortcutPlatform();
  const [draftShortcuts, setDraftShortcuts] =
    useState<KeyboardShortcutSettings>(keyboardShortcuts);
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [contextFilter, setContextFilter] =
    useState<ShortcutContextId | "all">("all");

  const commandById = useMemo(() => {
    return new Map(SHORTCUT_COMMANDS.map((command) => [command.id, command]));
  }, []);

  const hasChanges = useMemo(
    () => !areBindingsEqual(draftShortcuts.bindings, keyboardShortcuts.bindings),
    [draftShortcuts.bindings, keyboardShortcuts.bindings],
  );

  useEffect(() => {
    if (!hasChanges) {
      setDraftShortcuts(keyboardShortcuts);
    }
  }, [hasChanges, keyboardShortcuts]);

  const handleRestoreDefaults = useCallback(() => {
    setDraftShortcuts(DEFAULT_KEYBOARD_SHORTCUTS);
    setEditingCommandId(null);
  }, []);

  const updateBinding = useCallback(
    (command: ShortcutCommand, nextBinding: string | null) => {
      const normalizedDefault = normalizeBinding(
        getDefaultBinding(command, platform),
      );
      const normalizedNext =
        nextBinding === null ? null : normalizeBinding(nextBinding);
      setDraftShortcuts((prev) => {
        const nextBindings = { ...prev.bindings };
        if (normalizedNext === null) {
          nextBindings[command.id] = null;
        } else if (normalizedDefault && normalizedNext === normalizedDefault) {
          delete nextBindings[command.id];
        } else if (normalizedNext) {
          nextBindings[command.id] = normalizedNext;
        }
        return { ...prev, bindings: nextBindings };
      });
    },
    [platform],
  );

  const handleRestoreDefault = useCallback(
    (command: ShortcutCommand) => {
      setDraftShortcuts((prev) => {
        const nextBindings = { ...prev.bindings };
        delete nextBindings[command.id];
        return { ...prev, bindings: nextBindings };
      });
      if (editingCommandId === command.id) {
        setEditingCommandId(null);
      }
    },
    [editingCommandId],
  );

  const handleClearBinding = useCallback(
    (command: ShortcutCommand) => {
      updateBinding(command, null);
      if (editingCommandId === command.id) {
        setEditingCommandId(null);
      }
    },
    [editingCommandId, updateBinding],
  );

  const handleStartEditing = useCallback((commandId: string) => {
    setEditingCommandId(commandId);
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingCommandId(null);
  }, []);

  const handleSaveChanges = useCallback(() => {
    setKeyboardShortcuts(draftShortcuts);
    setEditingCommandId(null);
  }, [draftShortcuts, setKeyboardShortcuts]);

  const handleDiscardChanges = useCallback(() => {
    setDraftShortcuts(keyboardShortcuts);
    setEditingCommandId(null);
  }, [keyboardShortcuts]);

  useEffect(() => {
    if (!editingCommandId) {
      return;
    }
    const command = commandById.get(editingCommandId);
    if (!command) {
      setEditingCommandId(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const binding = eventToBinding(event);
      if (!binding) {
        return;
      }
      updateBinding(command, binding);
      setEditingCommandId(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [commandById, editingCommandId, updateBinding]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return SHORTCUT_COMMANDS.filter((command) => {
      if (
        contextFilter !== "all" &&
        !command.contexts.includes(contextFilter as ShortcutContextId)
      ) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        command.title.toLowerCase().includes(normalizedQuery) ||
        command.description.toLowerCase().includes(normalizedQuery) ||
        command.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [contextFilter, query]);

  const conflicts = useMemo(
    () => detectShortcutConflicts(SHORTCUT_COMMANDS, draftShortcuts.bindings, platform),
    [draftShortcuts.bindings, platform],
  );

  const conflictSummary = useMemo(() => {
    const summary = new Map<string, { binding: string; commandIds: string[] }>();
    conflicts.forEach((conflict) => {
      const uniqueIds = Array.from(new Set(conflict.commandIds));
      const key = `${conflict.binding}:${uniqueIds.sort().join(",")}`;
      if (!summary.has(key)) {
        summary.set(key, { binding: conflict.binding, commandIds: uniqueIds });
      }
    });
    return Array.from(summary.values());
  }, [conflicts]);

  const conflictsByCommand = useMemo(() => {
    const map = new Map<string, { bindings: Set<string>; related: Set<string> }>();
    conflicts.forEach((conflict) => {
      conflict.commandIds.forEach((commandId) => {
        const entry = map.get(commandId) ?? {
          bindings: new Set<string>(),
          related: new Set<string>(),
        };
        entry.bindings.add(conflict.binding);
        conflict.commandIds
          .filter((id) => id !== commandId)
          .forEach((id) => entry.related.add(id));
        map.set(commandId, entry);
      });
    });
    return map;
  }, [conflicts]);

  const handleJumpToCommand = useCallback((commandId: string) => {
    const row = document.getElementById(buildRowId(commandId));
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
    }
  }, []);

  return (
    <section className="panel keyboard-shortcuts-panel">
      <div className="panel-header settings-tab-header">
        <div>
          <h2>Keyboard Shortcuts</h2>
          <p className="muted">
            Rebind shortcuts per context. Conflicts must be resolved before saving.
          </p>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="ghost small"
            onClick={handleDiscardChanges}
            disabled={!hasChanges}
          >
            Discard
          </button>
          <button
            type="button"
            className="primary small"
            onClick={handleSaveChanges}
            disabled={!hasChanges || conflictSummary.length > 0}
          >
            Save changes
          </button>
        </div>
      </div>
      <div className="panel-body">
        <div className="shortcut-controls">
          <input
            className="text-input"
            type="search"
            placeholder="Search actions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search shortcuts"
          />
          <select
            className="text-input"
            value={contextFilter}
            onChange={(event) =>
              setContextFilter(event.target.value as ShortcutContextId | "all")
            }
            aria-label="Filter by context"
          >
            <option value="all">All contexts</option>
            {SHORTCUT_CONTEXTS.map((context) => (
              <option key={context.id} value={context.id}>
                {context.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost small"
            onClick={handleRestoreDefaults}
          >
            Restore defaults
          </button>
        </div>

        {conflictSummary.length > 0 ? (
          <div className="shortcut-conflicts" role="alert" aria-live="polite">
            <p className="shortcut-conflicts-title">
              Resolve {conflictSummary.length} conflict
              {conflictSummary.length === 1 ? "" : "s"} before saving.
            </p>
            {conflictSummary.map((conflict) => (
              <div key={`${conflict.binding}-${conflict.commandIds.join("-")}`}>
                <span className="shortcut-conflict-binding">
                  {formatBinding(conflict.binding, platform)}
                </span>
                <span className="shortcut-conflict-links">
                  {conflict.commandIds.map((commandId) => {
                    const command = commandById.get(commandId);
                    if (!command) {
                      return null;
                    }
                    return (
                      <button
                        key={commandId}
                        type="button"
                        className="ghost small"
                        onClick={() => handleJumpToCommand(commandId)}
                      >
                        {command.title}
                      </button>
                    );
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="shortcut-list">
          {filteredCommands.map((command) => {
            const effectiveBinding = getEffectiveBinding(
              command,
              draftShortcuts.bindings,
              platform,
            );
            const conflictInfo = conflictsByCommand.get(command.id);
            const isEditing = editingCommandId === command.id;
            const isConflicting = Boolean(conflictInfo?.bindings.size);
            const conflictBindings = conflictInfo
              ? Array.from(conflictInfo.bindings).map((binding) =>
                  formatBinding(binding, platform),
                )
              : [];
            const relatedCommands = conflictInfo
              ? Array.from(conflictInfo.related)
                  .map((id) => commandById.get(id)?.title)
                  .filter(Boolean)
              : [];
            const contextLabels = SHORTCUT_CONTEXTS.filter((context) =>
              command.contexts.includes(context.id),
            ).map((context) => context.label);

            return (
              <div
                key={command.id}
                id={buildRowId(command.id)}
                className={`shortcut-row ${isConflicting ? "is-conflict" : ""}`}
                tabIndex={-1}
              >
                <div className="shortcut-main">
                  <div className="shortcut-title">{command.title}</div>
                  <div className="shortcut-meta">
                    <div className="shortcut-contexts">
                      {contextLabels.length > 0 ? (
                        contextLabels.map((label) => (
                          <span key={label} className="shortcut-context">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="shortcut-context">Unknown</span>
                      )}
                    </div>
                    <span className="muted">{command.description}</span>
                    {command.notes ? (
                      <span className="muted">Note: {command.notes}</span>
                    ) : null}
                  </div>
                </div>
                <div className="shortcut-binding">
                  <span className="shortcut-chip">
                    {formatBinding(effectiveBinding, platform)}
                  </span>
                  {isEditing ? (
                    <span className="shortcut-capture">Press new keys...</span>
                  ) : null}
                </div>
                <div className="shortcut-actions">
                  {isEditing ? (
                    <button
                      type="button"
                      className="ghost small"
                      onClick={handleCancelEditing}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => handleStartEditing(command.id)}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => handleClearBinding(command)}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => handleRestoreDefault(command)}
                  >
                    Restore default
                  </button>
                </div>
                {isConflicting ? (
                  <div className="shortcut-conflict-detail">
                    Conflict: {conflictBindings.join(", ")} with{" "}
                    {relatedCommands.join(", ")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
