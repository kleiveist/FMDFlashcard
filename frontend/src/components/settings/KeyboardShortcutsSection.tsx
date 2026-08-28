/**
 * @file frontend/src/components/settings/KeyboardShortcutsSection.tsx
 *
 * Zweck:
 * - Rendert die Keyboard Shortcuts Settings Seite.
 *
 * Verantwortlichkeiten:
 * - Auflisten, Filtern und Rebinding von Shortcuts.
 * - Konflikte erkennen und Speichern blockieren.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  formatSettingsText,
  type SettingsI18nKey,
  type SettingsLanguage,
  tSettings,
} from "../../features/settings/settingsI18n";

type KeyboardShortcutsSectionProps = {
  language: SettingsLanguage;
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

const buildInfoPreview = (description: string, notes?: string, notePrefix = "Note:") => {
  const combined = notes ? `${description} ${notePrefix} ${notes}` : description;
  const normalized = combined.replace(/\s+/g, " ").trim();
  const maxLength = 120;
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
};

const SHORTCUT_CONTEXT_LABEL_KEYS: Record<ShortcutContextId, SettingsI18nKey> = {
  global: "settings.keyboard.context.global",
  study: "settings.keyboard.context.study",
  exam: "settings.keyboard.context.exam",
  "fast-flashcard": "settings.keyboard.context.fastFlashcard",
  flashcards: "settings.keyboard.context.flashcards",
  "spaced-repetition": "settings.keyboard.context.spacedRepetition",
  "markdown-editor": "settings.keyboard.context.markdownEditor",
  help: "settings.keyboard.context.help",
  "vault-tree": "settings.keyboard.context.vaultTree",
  modal: "settings.keyboard.context.modal",
};

const SHORTCUT_COMMAND_TITLE_KEYS: Partial<Record<string, SettingsI18nKey>> = {
  toggleViewMode: "settings.keyboard.command.toggleView.title",
  studyPrevious: "settings.keyboard.command.studyPrevious.title",
  studyNext: "settings.keyboard.command.studyNext.title",
  studySubmit: "settings.keyboard.command.studySubmit.title",
  "vault.refresh": "settings.keyboard.command.vaultRefresh.title",
  uiCloseOrBack: "settings.keyboard.command.closeOrBack.title",
};

const SHORTCUT_COMMAND_DESCRIPTION_KEYS: Partial<Record<string, SettingsI18nKey>> = {
  toggleViewMode: "settings.keyboard.command.toggleView.description",
  studyPrevious: "settings.keyboard.command.studyPrevious.description",
  studyNext: "settings.keyboard.command.studyNext.description",
  studySubmit: "settings.keyboard.command.studySubmit.description",
  "vault.refresh": "settings.keyboard.command.vaultRefresh.description",
  uiCloseOrBack: "settings.keyboard.command.closeOrBack.description",
};

const SHORTCUT_COMMAND_NOTES_KEYS: Partial<Record<string, SettingsI18nKey>> = {
  toggleViewMode: "settings.keyboard.command.toggleView.notes",
  "vault.refresh": "settings.keyboard.command.vaultRefresh.notes",
};

const resolveShortcutCommandCopy = (
  language: SettingsLanguage,
  command: ShortcutCommand,
) => {
  const titleKey = SHORTCUT_COMMAND_TITLE_KEYS[command.id];
  const descriptionKey = SHORTCUT_COMMAND_DESCRIPTION_KEYS[command.id];
  const notesKey = SHORTCUT_COMMAND_NOTES_KEYS[command.id];
  return {
    title: titleKey ? tSettings(language, titleKey) : command.title,
    description: descriptionKey
      ? tSettings(language, descriptionKey)
      : command.description,
    notes:
      command.notes && notesKey
        ? tSettings(language, notesKey)
        : command.notes,
  };
};

type ShortcutInfoButtonProps = {
  language: SettingsLanguage;
  commandId: string;
  description: string;
  notes?: string;
};

const ShortcutInfoButton = ({
  language,
  commandId,
  description,
  notes,
}: ShortcutInfoButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const popoverId = `shortcut-info-${commandId}`;
  const notePrefix = tSettings(language, "settings.keyboard.notePrefix");
  const preview = buildInfoPreview(description, notes, notePrefix);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <span ref={containerRef} className="shortcut-info">
      <button
        type="button"
        className="shortcut-info-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Shortcut description"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        title={preview}
      >
        ?
      </button>
      {isOpen ? (
        <div
          id={popoverId}
          className="shortcut-info-popover"
          role="dialog"
          aria-label="Shortcut description"
        >
          <p>{description}</p>
          {notes ? (
            <p className="muted">
              {notePrefix} {notes}
            </p>
          ) : null}
        </div>
      ) : null}
    </span>
  );
};

export const KeyboardShortcutsSection = ({
  language,
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
      const commandCopy = resolveShortcutCommandCopy(language, command);
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
        commandCopy.title.toLowerCase().includes(normalizedQuery) ||
        commandCopy.description.toLowerCase().includes(normalizedQuery) ||
        command.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [contextFilter, language, query]);

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
          <h2>{tSettings(language, "settings.keyboard.title")}</h2>
          <p className="muted">{tSettings(language, "settings.keyboard.description")}</p>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="ghost small"
            onClick={handleDiscardChanges}
            disabled={!hasChanges}
          >
            {tSettings(language, "settings.keyboard.discard")}
          </button>
          <button
            type="button"
            className="primary small"
            onClick={handleSaveChanges}
            disabled={!hasChanges || conflictSummary.length > 0}
          >
            {tSettings(language, "settings.keyboard.saveChanges")}
          </button>
        </div>
      </div>
      <div className="panel-body">
        <div className="shortcut-controls">
          <input
            className="text-input"
            type="search"
            placeholder={tSettings(language, "settings.keyboard.searchActions")}
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
            <option value="all">
              {tSettings(language, "settings.keyboard.allContexts")}
            </option>
            {SHORTCUT_CONTEXTS.map((context) => (
              <option key={context.id} value={context.id}>
                {tSettings(language, SHORTCUT_CONTEXT_LABEL_KEYS[context.id])}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost small"
            onClick={handleRestoreDefaults}
          >
            {tSettings(language, "settings.keyboard.restoreDefaults")}
          </button>
        </div>

        {conflictSummary.length > 0 ? (
          <div className="shortcut-conflicts" role="alert" aria-live="polite">
            <p className="shortcut-conflicts-title">
              {formatSettingsText(language, "settings.keyboard.resolveConflicts", {
                count: conflictSummary.length,
                suffix:
                  conflictSummary.length === 1
                    ? ""
                    : language === "de"
                      ? "e"
                      : "s",
              })}
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
                        {resolveShortcutCommandCopy(language, command).title}
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
            const commandCopy = resolveShortcutCommandCopy(language, command);
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
                  .map((id) => {
                    const related = commandById.get(id);
                    if (!related) {
                      return null;
                    }
                    return resolveShortcutCommandCopy(language, related).title;
                  })
                  .filter(Boolean)
              : [];
            const contextLabels = SHORTCUT_CONTEXTS.filter((context) =>
              command.contexts.includes(context.id),
            ).map((context) => tSettings(language, SHORTCUT_CONTEXT_LABEL_KEYS[context.id]));

            return (
              <div
                key={command.id}
                id={buildRowId(command.id)}
                className={`shortcut-row ${isConflicting ? "is-conflict" : ""}`}
                tabIndex={-1}
              >
                <div className="shortcut-row-top">
                  <div className="shortcut-row-left">
                    {isEditing ? (
                      <button
                        type="button"
                        className="ghost small"
                        onClick={handleCancelEditing}
                      >
                        {tSettings(language, "settings.keyboard.cancel")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => handleStartEditing(command.id)}
                      >
                        {tSettings(language, "settings.keyboard.edit")}
                      </button>
                    )}
                    <span className="shortcut-title">{commandCopy.title}</span>
                    <ShortcutInfoButton
                      language={language}
                      commandId={command.id}
                      description={commandCopy.description}
                      notes={commandCopy.notes}
                    />
                  </div>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => handleClearBinding(command)}
                  >
                    {tSettings(language, "settings.keyboard.clear")}
                  </button>
                </div>
                <div className="shortcut-row-meta">
                  <div className="shortcut-contexts">
                    {contextLabels.length > 0 ? (
                      contextLabels.map((label) => (
                        <span key={label} className="shortcut-context">
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="shortcut-context">
                        {tSettings(language, "settings.keyboard.unknown")}
                      </span>
                    )}
                  </div>
                  <div className="shortcut-binding">
                    <button type="button" className="shortcut-chip">
                      {formatBinding(effectiveBinding, platform)}
                    </button>
                    {isEditing ? (
                      <span className="shortcut-capture">
                        {tSettings(language, "settings.keyboard.pressNewKeys")}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="ghost small shortcut-restore"
                    onClick={() => handleRestoreDefault(command)}
                  >
                    {tSettings(language, "settings.keyboard.restoreDefault")}
                  </button>
                </div>
                {isConflicting ? (
                  <div className="shortcut-conflict-detail">
                    {formatSettingsText(language, "settings.keyboard.conflictWith", {
                      bindings: conflictBindings.join(", "),
                      related: relatedCommands.join(", "),
                    })}
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
