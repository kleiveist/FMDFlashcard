/**
 * @file apps/fmd-desktop/src/pages/help/content/appSections/index.ts
 *
 * Purpose:
 * - Provides the "App Sections" guide content for Help.
 *
 * Notes:
 * - Each app section is defined in its own module under ./sections.
 * - "Makedon / Dashboard" has been removed and replaced by "Exam".
 */

import { AppSectionData, AppSectionId, LocalizedText } from "../types";

import { flashcardSection } from "./sections/flashcard";
import { fastFlashcardSection } from "./sections/fastFlashcard";
import { spacedRepetitionSection } from "./sections/spacedRepetition";
import { examSection } from "./sections/exam";

export const APP_SECTION_ORDER: AppSectionId[] = [
  "exam",
  "flashcard",
  "fast-flashcard",
  "spaced-repetition",
];

export const APP_SECTION_GROUND_RULES: {
  paragraph: LocalizedText;
  bullets: LocalizedText[];
} = {
  paragraph: {
    en: "Use the sections below to understand what each mode does and how to run it end-to-end.",
    de: "Nutze die Sektionen unten, um zu verstehen, was jeder Modus leistet und wie du ihn von Anfang bis Ende durchfuehrst.",
  },
  bullets: [
    {
      en: "Pick a section on the left; the detail panel updates instantly.",
      de: "Waehle links eine Sektion; der Detailbereich aktualisiert sich sofort.",
    },
    {
      en: "The highlighted entry shows your current topic and helps you switch quickly.",
      de: "Der markierte Eintrag zeigt dein aktuelles Thema und erleichtert den schnellen Wechsel.",
    },
    {
      en: "Each section explains: what it is, what it is for, what you see there, and the core workflow.",
      de: "Jede Sektion erklaert: Was ist das, wofuer ist es, was du dort siehst, und den Core-Workflow.",
    },
  ],
};

export const APP_SECTION_LABELS = {
  groundRulesTitle: { en: "Ground rules", de: "Grundregeln" },
  typicalAction: { en: "Typical action", de: "Typische Aktion" },
  whatIs: { en: "What is it?", de: "Was ist das?" },
  purpose: { en: "What is it for?", de: "Wofuer ist es?" },
  whatYouSee: { en: "What you see there", de: "Was du dort siehst" },
  showCards: { en: "Show cards & filter", de: "Karten anzeigen & filtern" },
  workflow: { en: "Core workflow", de: "Core-Workflow" },
  tips: { en: "Tips", de: "Tipps" },
};

export const APP_SECTION_DATA: Record<AppSectionId, AppSectionData> = {
  flashcard: flashcardSection,
  "fast-flashcard": fastFlashcardSection,
  "spaced-repetition": spacedRepetitionSection,
  exam: examSection,
};
