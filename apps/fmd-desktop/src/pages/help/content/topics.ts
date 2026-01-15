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
    id: "app-sections",
    title: { en: "App Sections", de: "App Sections" },
    summary: {
      en: "Overview, navigation, and typical workflows for new users, with a quick tour of each main area.",
      de: "Ueberblick, Navigation und typische Workflows fuer neue Nutzer, inklusive kurzem Rundgang durch alle Hauptbereiche.",
    },
    sections: [],
  },
  {
    id: "structured-syntax",
    title: { en: "Structured syntax", de: "Strukturierte Syntax" },
    summary: {
      en: "Structured blocks for exams, cards, and hints with rules and templates.",
      de: "Strukturierte Bloecke fuer Exams, Karten und Hinweise mit Regeln und Vorlagen.",
    },
    sections: [],
  },
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
    id: "vault",
    title: { en: "Load a vault", de: "Vault laden" },
    summary: {
      en: "Select a vault, confirm permissions, and troubleshoot common issues when lists stay empty.",
      de: "Waehle einen Vault aus, bestaetige Berechtigungen und loese typische Probleme, wenn Listen leer bleiben.",
    },
    sections: [],
  },
];
