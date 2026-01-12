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
  | "study"
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
  { id: "study", label: "Study" },
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
    contexts: ["study"],
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
    id: "studyPrevious",
    title: "Previous card",
    description: "Go to the previous card or task in Study screens.",
    contexts: ["study"],
    defaultBinding: { winLinux: "ArrowLeft", mac: "ArrowLeft" },
  },
  {
    id: "studyNext",
    title: "Next card",
    description: "Go to the next card or task in Study screens.",
    contexts: ["study"],
    defaultBinding: { winLinux: "ArrowRight", mac: "ArrowRight" },
  },
  {
    id: "studySubmit",
    title: "Submit card",
    description: "Submit the current card when it is ready.",
    contexts: ["study"],
    defaultBinding: { winLinux: "Enter", mac: "Enter" },
  },
  {
    id: "uiCloseOrBack",
    title: "Close / Back",
    description: "Close dialogs/menus or return from help detail.",
    contexts: ["global"],
    defaultBinding: { winLinux: "Escape", mac: "Escape" },
    allowInTextInputs: true,
  },
];

export const SHORTCUTS_BY_ID = new Map(
  SHORTCUT_COMMANDS.map((command) => [command.id, command]),
);

export const getShortcutById = (id: string) => SHORTCUTS_BY_ID.get(id) ?? null;
