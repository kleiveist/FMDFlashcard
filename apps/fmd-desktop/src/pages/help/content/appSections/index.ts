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
  paragraph: { en: "", de: "" },
  bullets: [],
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
