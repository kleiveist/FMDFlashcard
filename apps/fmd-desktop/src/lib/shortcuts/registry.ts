/**
 * @file apps/fmd-desktop/src/lib/shortcuts/registry.ts
 *
 * Zweck:
 * - Zentrale Quelle fuer Shortcut-Definitionen.
 *
 * Verantwortlichkeiten:
 * - Listet alle Commands inkl. Kontext, Beschreibung und Default-Bindings.
 * - Liefert Kontext-Metadaten fuer UI/Docs.
 *
 * Hinweise:
 * - UI und Dokumentation sollen nur aus diesem Registry-Modul lesen.
 */

export type ShortcutContextId =
  | "global"
  | "exam"
  | "fast-flashcard"
  | "flashcards"
  | "spaced-repetition"
  | "markdown-editor"
  | "help"
  | "vault-tree"
  | "modal";

export type ShortcutContext = {
  id: ShortcutContextId;
  label: string;
  description?: string;
};

export type ShortcutBindingSpec = {
  winLinux: string;
  mac?: string;
};

export type ShortcutCommand = {
  id: string;
  title: string;
  description: string;
  contexts: ShortcutContextId[];
  defaultBinding: ShortcutBindingSpec;
  allowInTextInputs?: boolean;
  notes?: string;
  discoverableUI?: string[];
};

export const SHORTCUT_CONTEXTS: ShortcutContext[] = [
  { id: "global", label: "Global" },
  { id: "exam", label: "Exam" },
  { id: "fast-flashcard", label: "Fast Flashcard" },
  { id: "flashcards", label: "Flashcards" },
  { id: "spaced-repetition", label: "Spaced Repetition" },
  { id: "markdown-editor", label: "Markdown editor" },
  { id: "help", label: "Help / Docs" },
  { id: "vault-tree", label: "Vault Tree" },
  { id: "modal", label: "Dialogs & Modals" },
];

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  {
    id: "toggleViewMode",
    title: "Toggle View",
    description: "Toggle View on/off (distraction-free layout).",
    contexts: ["flashcards", "spaced-repetition", "exam", "fast-flashcard"],
    defaultBinding: { winLinux: "F", mac: "F" },
    notes: "Toggles the eye icon view in supported pages.",
    discoverableUI: [
      "flashcards.view-toggle",
      "spaced-repetition.view-toggle",
      "exam.view-toggle",
      "fast-flashcard.view-toggle",
    ],
  },
  {
    id: "flashcards.focus.prev",
    title: "Previous card",
    description: "Go to the previous flashcard in View mode.",
    contexts: ["flashcards"],
    defaultBinding: { winLinux: "ArrowLeft", mac: "ArrowLeft" },
    notes: "View mode only.",
  },
  {
    id: "flashcards.focus.next",
    title: "Next card",
    description: "Go to the next flashcard in View mode.",
    contexts: ["flashcards"],
    defaultBinding: { winLinux: "ArrowRight", mac: "ArrowRight" },
    notes: "View mode only.",
  },
  {
    id: "flashcards.focus.submit",
    title: "Submit card",
    description: "Submit the current card when it is ready.",
    contexts: ["flashcards"],
    defaultBinding: { winLinux: "Enter", mac: "Enter" },
    notes: "View mode only.",
  },
  {
    id: "spaced-repetition.focus.prev",
    title: "Previous card",
    description: "Go to the previous card in View mode.",
    contexts: ["spaced-repetition"],
    defaultBinding: { winLinux: "ArrowLeft", mac: "ArrowLeft" },
    notes: "View mode only.",
  },
  {
    id: "spaced-repetition.focus.next",
    title: "Next card",
    description: "Go to the next card in View mode.",
    contexts: ["spaced-repetition"],
    defaultBinding: { winLinux: "ArrowRight", mac: "ArrowRight" },
    notes: "View mode only.",
  },
  {
    id: "spaced-repetition.focus.submit",
    title: "Submit card",
    description: "Submit the current card when it is ready.",
    contexts: ["spaced-repetition"],
    defaultBinding: { winLinux: "Enter", mac: "Enter" },
    notes: "View mode only.",
  },
  {
    id: "help.topic.close",
    title: "Close help topic",
    description: "Return to the help overview.",
    contexts: ["help"],
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Help detail view only.",
  },
  {
    id: "vault.context-menu.close",
    title: "Close context menu",
    description: "Dismiss the vault context menu.",
    contexts: ["vault-tree"],
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Vault context menu only.",
  },
  {
    id: "vault.create-modal.cancel",
    title: "Cancel create dialog",
    description: "Close the create file/folder dialog.",
    contexts: ["modal"],
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Create file/folder dialog.",
  },
];

export const SHORTCUTS_BY_ID = new Map(
  SHORTCUT_COMMANDS.map((command) => [command.id, command]),
);

export const getShortcutById = (id: string) => SHORTCUTS_BY_ID.get(id) ?? null;
