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
  | "examen"
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
  context: ShortcutContextId;
  defaultBinding: ShortcutBindingSpec;
  allowInTextInputs?: boolean;
  notes?: string;
  discoverableUI?: string[];
};

export const SHORTCUT_CONTEXTS: ShortcutContext[] = [
  { id: "global", label: "Global" },
  { id: "examen", label: "Examen" },
  { id: "flashcards", label: "Flashcards" },
  { id: "spaced-repetition", label: "Spaced Repetition" },
  { id: "markdown-editor", label: "Markdown editor" },
  { id: "help", label: "Help / Docs" },
  { id: "vault-tree", label: "Vault Tree" },
  { id: "modal", label: "Dialogs & Modals" },
];

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  {
    id: "flashcards.focus.toggle",
    title: "Toggle Live Mode",
    description: "Enter or exit focus mode to hide surrounding panels.",
    context: "flashcards",
    defaultBinding: { winLinux: "F", mac: "F" },
    notes: "Flashcards page.",
    discoverableUI: ["flashcards.focus-toggle"],
  },
  {
    id: "flashcards.focus.exit",
    title: "Exit Live Mode",
    description: "Leave focus mode and restore the full layout.",
    context: "flashcards",
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Focus mode only.",
    discoverableUI: ["flashcards.focus-toggle"],
  },
  {
    id: "flashcards.focus.prev",
    title: "Previous card",
    description: "Go to the previous flashcard in focus mode.",
    context: "flashcards",
    defaultBinding: { winLinux: "ArrowLeft", mac: "ArrowLeft" },
    notes: "Focus mode only.",
  },
  {
    id: "flashcards.focus.next",
    title: "Next card",
    description: "Go to the next flashcard in focus mode.",
    context: "flashcards",
    defaultBinding: { winLinux: "ArrowRight", mac: "ArrowRight" },
    notes: "Focus mode only.",
  },
  {
    id: "flashcards.focus.submit",
    title: "Submit card",
    description: "Submit the current card when it is ready.",
    context: "flashcards",
    defaultBinding: { winLinux: "Enter", mac: "Enter" },
    notes: "Focus mode only.",
  },
  {
    id: "spaced-repetition.focus.toggle",
    title: "Toggle Live Mode",
    description: "Enter or exit focus mode to hide surrounding panels.",
    context: "spaced-repetition",
    defaultBinding: { winLinux: "F", mac: "F" },
    notes: "Spaced Repetition page.",
    discoverableUI: ["spaced-repetition.focus-toggle"],
  },
  {
    id: "spaced-repetition.focus.exit",
    title: "Exit Live Mode",
    description: "Leave focus mode and restore the full layout.",
    context: "spaced-repetition",
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Focus mode only.",
    discoverableUI: ["spaced-repetition.focus-toggle"],
  },
  {
    id: "spaced-repetition.focus.prev",
    title: "Previous card",
    description: "Go to the previous card in focus mode.",
    context: "spaced-repetition",
    defaultBinding: { winLinux: "ArrowLeft", mac: "ArrowLeft" },
    notes: "Focus mode only.",
  },
  {
    id: "spaced-repetition.focus.next",
    title: "Next card",
    description: "Go to the next card in focus mode.",
    context: "spaced-repetition",
    defaultBinding: { winLinux: "ArrowRight", mac: "ArrowRight" },
    notes: "Focus mode only.",
  },
  {
    id: "spaced-repetition.focus.submit",
    title: "Submit card",
    description: "Submit the current card when it is ready.",
    context: "spaced-repetition",
    defaultBinding: { winLinux: "Enter", mac: "Enter" },
    notes: "Focus mode only.",
  },
  {
    id: "help.topic.close",
    title: "Close help topic",
    description: "Return to the help overview.",
    context: "help",
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Help detail view only.",
  },
  {
    id: "vault.context-menu.close",
    title: "Close context menu",
    description: "Dismiss the vault context menu.",
    context: "vault-tree",
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Vault context menu only.",
  },
  {
    id: "vault.create-modal.cancel",
    title: "Cancel create dialog",
    description: "Close the create file/folder dialog.",
    context: "modal",
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
    notes: "Create file/folder dialog.",
  },
];

export const SHORTCUTS_BY_ID = new Map(
  SHORTCUT_COMMANDS.map((command) => [command.id, command]),
);

export const getShortcutById = (id: string) => SHORTCUTS_BY_ID.get(id) ?? null;
