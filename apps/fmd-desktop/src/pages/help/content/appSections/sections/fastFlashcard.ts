import { AppSectionData } from "../../types";

export const fastFlashcardSection: AppSectionData = {
  title: { en: "Fast Flashcard", de: "Fast Flashcard" },
  summary: {
    en: "Timed sprints with duration pills and scoring for quick practice.",
    de: "Zeitgesteuerte Sprints mit Dauer-Buttons und Score fuer schnelles Training.",
  },
  action: { en: "Start the timer", de: "Timer starten" },
  detail: {
    whatIs: {
      en: "Fast Flashcard is a speed-focused mode that wraps reviews in a timer and produces quick session scoring.",
      de: "Fast Flashcard ist ein Tempo-Modus, der Reviews mit Timer kombiniert und schnelle Session-Scores erzeugt.",
    },
    purpose: [
      {
        en: "Train short, intense repetitions and measure pace and accuracy under time pressure.",
        de: "Kurze, intensive Wiederholungen trainieren und Tempo/Genauigkeit unter Zeitdruck messen.",
      },
      {
        en: "Use short runs to build momentum without committing to a long session.",
        de: "Kurze Runs nutzen, um Momentum aufzubauen, ohne eine lange Session zu starten.",
      },
    ],
    whatYouSee: {
      en: "A timer, sprint controls (duration), session scoring, and the same core review actions as in Flashcard.",
      de: "Einen Timer, Sprint-Controls (Dauer), Session-Score sowie die Kern-Review-Aktionen wie bei Flashcard.",
    },
    showCards: {
      en: "Cards follow scope/order/mode; duration controls mainly influence pacing, not card detection.",
      de: "Karten folgen Scope/Order/Mode; Dauer-Controls steuern vor allem das Tempo, nicht die Kartenerkennung.",
    },
    workflow: {
      en: "Scan note → choose duration → start timer → answer quickly → end run → review score.",
      de: "Notiz scannen → Dauer waehlen → Timer starten → schnell beantworten → Run beenden → Score pruefen.",
    },
    tips: {
      en: "Keep durations consistent when comparing performance; change only one parameter at a time (scope or order).",
      de: "Dauer konstant halten fuer Vergleiche; jeweils nur einen Parameter aendern (Scope oder Order).",
    },
  },
};
