import { HelpTopic } from "./types";

export const helpTopics: HelpTopic[] = [
  {
    id: "flashcard-syntax",
    title: { en: "Flashcard syntax", de: "Karteikarten-Syntax" },
    summary: {
      en: "Complete syntax reference with examples for every supported card type, plus rules and copy-ready templates.",
      de: "Komplette Syntax-Referenz mit Beispielen fuer alle Kartentypen sowie Regeln und Vorlagen zum Kopieren.",
    },
    sections: [],
  },
  {
    id: "app-sections",
    title: { en: "App Sections", de: "App Sections" },
    summary: {
      en: "Overview, navigation, and typical workflows for new users, with a quick tour of each main area.",
      de: "Ueberblick, Navigation und typische Workflows fuer neue Nutzer, inklusive kurzem Rundgang durch alle Hauptbereiche.",
    },
    sections: [],
  },
  {
    id: "settings",
    title: { en: "Settings explained", de: "Einstellungen erklaert" },
    summary: {
      en: "What the main options control and where defaults live, so you can predict tool behavior between sessions.",
      de: "Welche Optionen was steuern und wo Standards gesetzt werden, damit das Tool-Verhalten nachvollziehbar bleibt.",
    },
    sections: [
      {
        id: "settings-flashcards",
        title: { en: "Flashcard Tools defaults", de: "Flashcard-Tools-Defaults" },
        bullets: [
          {
            en: "Scan scope, order, page size, and stats reset define the review flow and which cards appear.",
            de: "Scan-Scope, Reihenfolge, Page Size und Statistik-Reset steuern den Ablauf und welche Karten erscheinen.",
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
            en: "Boxes, order, page size, and repetition strength set SR behavior and repeat frequency.",
            de: "Boxen, Reihenfolge, Page Size und Repetition Strength bestimmen SR und die Wiederholfrequenz.",
          },
        ],
      },
      {
        id: "settings-language",
        title: { en: "Language & appearance", de: "Sprache & Aussehen" },
        bullets: [
          {
            en: "Language switches labels instantly; theme and accent change visuals without touching your data.",
            de: "Sprache schaltet Labels sofort um; Theme und Accent aendern die Optik ohne deine Daten zu veraendern.",
          },
        ],
      },
      {
        id: "settings-persistence",
        title: { en: "Persistence", de: "Persistenz" },
        bullets: [
          {
            en: "All settings and tool options are saved automatically and restored after restart.",
            de: "Alle Einstellungen und Tool-Optionen werden automatisch gespeichert und nach Neustart wiederhergestellt.",
          },
        ],
      },
    ],
  },
  {
    id: "advanced",
    title: { en: "More settings / Advanced", de: "Weitere Einstellungen / Advanced" },
    summary: {
      en: "Performance, layout tweaks, and power options for heavier vaults or personal preferences.",
      de: "Performance, Layout-Anpassungen und Power-Optionen fuer groessere Vaults oder persoenliche Vorlieben.",
    },
    sections: [
      {
        id: "advanced-performance",
        title: { en: "Performance", de: "Performance" },
        bullets: [
          {
            en: "Max files per scan and scan parallelism limit how much is indexed at once; lower values can reduce load.",
            de: "Max Files pro Scan und Scan-Parallelism begrenzen die Indexierung; kleinere Werte entlasten das System.",
          },
        ],
      },
      {
        id: "advanced-layout",
        title: { en: "Layout", de: "Layout" },
        bullets: [
          {
            en: "The right toolbar can be collapsed and restored with the FMD toggle to free screen space.",
            de: "Die rechte Toolbar laesst sich ueber den FMD-Schalter einklappen, um mehr Platz zu schaffen.",
          },
        ],
      },
      {
        id: "advanced-data",
        title: { en: "Data & Sync", de: "Data & Sync" },
        bullets: [
          {
            en: "Data & Sync collects storage-related options; some items may be placeholders depending on the build.",
            de: "Data & Sync enthaelt Speicher-Optionen; einige Punkte koennen je nach Build Platzhalter sein.",
          },
        ],
      },
    ],
  },
  {
    id: "vault",
    title: { en: "Load a vault", de: "Vault laden" },
    summary: {
      en: "Select a vault, confirm permissions, and troubleshoot common issues when lists stay empty.",
      de: "Vault auswaehlen, Berechtigungen bestaetigen und typische Probleme bei leeren Listen beheben.",
    },
    sections: [
      {
        id: "vault-select",
        title: { en: "Select a vault", de: "Vault auswaehlen" },
        bullets: [
          {
            en: "Use Makedon to choose a folder and allow access when prompted; confirm the correct path.",
            de: "In Makedon einen Ordner waehlen und Zugriff erlauben; den richtigen Pfad bestaetigen.",
          },
          {
            en: "After loading, pick a note to preview and scan so cards populate the tools.",
            de: "Nach dem Laden eine Notiz waehlen, Vorschau pruefen und scannen, damit Karten geladen werden.",
          },
        ],
      },
      {
        id: "vault-issues",
        title: { en: "Common issues", de: "Haeufige Probleme" },
        bullets: [
          {
            en: "Missing permissions can block the file list or previews; re-approve access if needed.",
            de: "Fehlende Berechtigungen blockieren Dateiliste oder Vorschau; Zugriff ggf. erneut erlauben.",
          },
          {
            en: "If the list is empty, verify the path, markdown file types, and any active filters.",
            de: "Bei leerer Liste Pfad, Markdown-Dateien und aktive Filter pruefen.",
          },
          {
            en: "If the vault moved, reselect it in Makedon and scan again.",
            de: "Wenn der Vault verschoben wurde, neu in Makedon auswaehlen und erneut scannen.",
          },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: { en: "Additional features", de: "Weitere Funktionsbereiche" },
    summary: {
      en: "Focus mode, shortcuts, and optional tooling to speed up review and reduce distractions.",
      de: "Fokusmodus, Shortcuts und optionale Funktionen fuer schnelleres Review und weniger Ablenkung.",
    },
    sections: [
      {
        id: "extras-focus",
        title: { en: "Focus mode", de: "Fokusmodus" },
        bullets: [
          {
            en: "Use the eye icon to focus on the card and hide the rest of the UI for distraction-free review.",
            de: "Mit dem Auge-Icon nur die Karte anzeigen und den Rest fuer konzentriertes Review ausblenden.",
          },
          {
            en: "Press Esc to exit focus mode and restore the full layout.",
            de: "Mit Esc den Fokusmodus verlassen und das volle Layout wiederherstellen.",
          },
        ],
      },
      {
        id: "extras-shortcuts",
        title: { en: "Shortcuts", de: "Shortcuts" },
        bullets: [
          {
            en: "In focus mode: Left/Right for Back/Next, Enter to submit when possible, keeping hands on the keyboard.",
            de: "Im Fokusmodus: Links/Rechts fuer Zurueck/Weiter, Enter zum Abgeben; Haende bleiben auf der Tastatur.",
          },
          {
            en: "Shortcuts are ignored while typing in inputs to avoid accidental submissions.",
            de: "Shortcuts werden in Eingabefeldern ignoriert, um Fehlklicks zu vermeiden.",
          },
        ],
      },
      {
        id: "extras-import",
        title: { en: "Import / Export", de: "Import / Export" },
        bullets: [
          {
            en: "If available, use Data & Sync to manage exports; otherwise it is coming later and not yet wired.",
            de: "Falls vorhanden, ueber Data & Sync exportieren; sonst Coming Later und noch nicht verfuegbar.",
          },
        ],
      },
    ],
  },
];
