import { HelpTopic } from "./types";

export const helpTopics: HelpTopic[] = [
  {
    id: "flashcard-syntax",
    title: { en: "Flashcard syntax", de: "Karteikarten-Syntax" },
    summary: {
      en: "Complete syntax reference with examples for every supported card type.",
      de: "Komplette Syntax-Referenz mit Beispielen fuer alle Kartentypen.",
    },
    sections: [],
  },
  {
    id: "app-sections",
    title: { en: "App Sections", de: "App Sections" },
    summary: {
      en: "Overview, navigation, and typical workflows for new users.",
      de: "Ueberblick, Navigation und typische Workflows fuer neue Nutzer.",
    },
    sections: [],
  },
  {
    id: "settings",
    title: { en: "Settings explained", de: "Einstellungen erklaert" },
    summary: {
      en: "What the main options control and where defaults live.",
      de: "Welche Optionen was steuern und wo Standards gesetzt werden.",
    },
    sections: [
      {
        id: "settings-flashcards",
        title: { en: "Flashcard Tools defaults", de: "Flashcard-Tools-Defaults" },
        bullets: [
          {
            en: "Scan scope, order, page size, and stats reset define the review flow.",
            de: "Scan-Scope, Reihenfolge, Page Size und Statistik-Reset steuern den Ablauf.",
          },
        ],
      },
      {
        id: "settings-sr",
        title: {
          en: "Spaced Repetition defaults",
          de: "Spaced Repetition-Defaults",
        },
        bullets: [
          {
            en: "Boxes, order, page size, and repetition strength set SR behavior.",
            de: "Boxen, Reihenfolge, Page Size und Repetition Strength bestimmen SR.",
          },
        ],
      },
      {
        id: "settings-language",
        title: { en: "Language & appearance", de: "Sprache & Aussehen" },
        bullets: [
          {
            en: "Language switches labels instantly; theme and accent change visuals.",
            de: "Sprache schaltet Labels sofort um; Theme und Accent aendern das Aussehen.",
          },
        ],
      },
      {
        id: "settings-persistence",
        title: { en: "Persistence", de: "Persistenz" },
        bullets: [
          {
            en: "All settings and tool options are saved automatically and restored after restart.",
            de: "Alle Einstellungen und Tool-Optionen werden automatisch gespeichert.",
          },
        ],
      },
    ],
  },
  {
    id: "advanced",
    title: { en: "More settings / Advanced", de: "Weitere Einstellungen / Advanced" },
    summary: {
      en: "Performance, layout tweaks, and power options.",
      de: "Performance, Layout-Anpassungen und Power-Optionen.",
    },
    sections: [
      {
        id: "advanced-performance",
        title: { en: "Performance", de: "Performance" },
        bullets: [
          {
            en: "Max files per scan and scan parallelism limit how much is indexed at once.",
            de: "Max Files pro Scan und Scan-Parallelism begrenzen die Indexierung.",
          },
        ],
      },
      {
        id: "advanced-layout",
        title: { en: "Layout", de: "Layout" },
        bullets: [
          {
            en: "The right toolbar can be collapsed and restored with the FMD toggle.",
            de: "Die rechte Toolbar laesst sich ueber den FMD-Schalter einklappen.",
          },
        ],
      },
      {
        id: "advanced-data",
        title: { en: "Data & Sync", de: "Data & Sync" },
        bullets: [
          {
            en: "Data & Sync collects storage-related options; some items may be placeholders.",
            de: "Data & Sync enthaelt Speicher-Optionen; einige Punkte koennen Platzhalter sein.",
          },
        ],
      },
    ],
  },
  {
    id: "vault",
    title: { en: "Load a vault", de: "Vault laden" },
    summary: {
      en: "Select a vault and troubleshoot common issues.",
      de: "Vault auswaehlen und typische Probleme beheben.",
    },
    sections: [
      {
        id: "vault-select",
        title: { en: "Select a vault", de: "Vault auswaehlen" },
        bullets: [
          {
            en: "Use Dashboard to choose a folder and allow access when prompted.",
            de: "Im Dashboard einen Ordner waehlen und Zugriff erlauben.",
          },
          {
            en: "After loading, pick a note to preview and scan.",
            de: "Nach dem Laden eine Notiz waehlen und scannen.",
          },
        ],
      },
      {
        id: "vault-issues",
        title: { en: "Common issues", de: "Haeufige Probleme" },
        bullets: [
          {
            en: "Missing permissions can block the file list or previews.",
            de: "Fehlende Berechtigungen blockieren Dateiliste oder Vorschau.",
          },
          {
            en: "If the list is empty, verify the path and markdown file types.",
            de: "Bei leerer Liste Pfad und Markdown-Dateien pruefen.",
          },
          {
            en: "If the vault moved, reselect it in Dashboard.",
            de: "Wenn der Vault verschoben wurde, neu auswaehlen.",
          },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: { en: "Additional features", de: "Weitere Funktionsbereiche" },
    summary: {
      en: "Focus mode, shortcuts, and optional tooling.",
      de: "Fokusmodus, Shortcuts und optionale Funktionen.",
    },
    sections: [
      {
        id: "extras-focus",
        title: { en: "Focus mode", de: "Fokusmodus" },
        bullets: [
          {
            en: "Use the eye icon to focus on the card and hide the rest of the UI.",
            de: "Mit dem Auge-Icon nur die Karte anzeigen und den Rest ausblenden.",
          },
          {
            en: "Press Esc to exit focus mode.",
            de: "Mit Esc den Fokusmodus verlassen.",
          },
        ],
      },
      {
        id: "extras-shortcuts",
        title: { en: "Shortcuts", de: "Shortcuts" },
        bullets: [
          {
            en: "In focus mode: Left/Right for Back/Next, Enter to submit when possible.",
            de: "Im Fokusmodus: Links/Rechts fuer Zurueck/Weiter, Enter zum Abgeben.",
          },
          {
            en: "Shortcuts are ignored while typing in inputs.",
            de: "Shortcuts werden in Eingabefeldern ignoriert.",
          },
        ],
      },
      {
        id: "extras-import",
        title: { en: "Import / Export", de: "Import / Export" },
        bullets: [
          {
            en: "If available, use Data & Sync to manage exports; otherwise it is coming later.",
            de: "Falls vorhanden, ueber Data & Sync exportieren; sonst Coming Later.",
          },
        ],
      },
    ],
  },
];
