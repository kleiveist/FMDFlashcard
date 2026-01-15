/**
 * @file apps/fmd-desktop/src/pages/help/content/topics.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Help.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Help bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/content/types.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

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
      de: "Waehle einen Vault aus, bestaetige Berechtigungen und loese typische Probleme, wenn Listen leer bleiben.",
    },
    sections: [],
  },
  {
    id: "extras",
    title: { en: "Additional features", de: "Weitere Funktionsbereiche" },
    summary: {
      en: "View mode, shortcuts, and optional tooling to speed up review and reduce distractions.",
      de: "Ansichtsmodus, Shortcuts und optionale Funktionen fuer schnelleres Review und weniger Ablenkung.",
    },
    sections: [
      {
        id: "extras-focus",
        title: { en: "View mode", de: "Ansichtsmodus" },
        bullets: [
          {
            en: "Use the eye icon to toggle View and hide the rest of the UI for distraction-free review.",
            de: "Mit dem Auge-Icon den Ansichtsmodus umschalten und den Rest fuer konzentriertes Review ausblenden.",
          },
          {
            en: "Press F again to exit View and restore the full layout.",
            de: "Mit F den Ansichtsmodus wieder verlassen und das volle Layout wiederherstellen.",
          },
        ],
      },
      {
        id: "extras-shortcuts",
        title: { en: "Shortcuts", de: "Shortcuts" },
        bullets: [
          {
            en: "In View mode: Left/Right for Back/Next, Enter to submit when possible, keeping hands on the keyboard.",
            de: "Im Ansichtsmodus: Links/Rechts fuer Zurueck/Weiter, Enter zum Abgeben; Haende bleiben auf der Tastatur.",
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
