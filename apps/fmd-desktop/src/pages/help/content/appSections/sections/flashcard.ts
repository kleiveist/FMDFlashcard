import { AppSectionData } from "../../types";

export const flashcardSection: AppSectionData = {
  title: { en: "Flashcard", de: "Flashcard" },
  summary: {
    en: "Standard review with stats and filters to pace a focused session.",
    de: "Standard-Review mit Statistiken und Filtern, um eine fokussierte Session zu steuern.",
  },
  action: { en: "Start a review", de: "Review starten" },
  detail: {
    whatIs: {
      en: "Flashcard is the classic review mode for single cards with navigation and session-level stats.",
      de: "Flashcard ist der klassische Review-Modus fuer Einzelkarten mit Navigation und Session-Statistiken.",
    },
    purpose: [
      {
        en: "Practice deliberately while keeping accuracy and totals visible.",
        de: "Systematisch ueben und dabei Genauigkeit sowie Totale im Blick behalten.",
      },
      {
        en: "Use filters (order, scope, mode, page size) to control what appears in the session.",
        de: "Filter (Order, Scope, Mode, Page Size) nutzen, um zu steuern, was in der Session erscheint.",
      },
    ],
    whatYouSee: {
      en: "A card view with submit actions, counters, and tool controls that shape the session flow.",
      de: "Eine Kartenansicht mit Submit-Aktionen, Zaehlern und Tools, die den Session-Ablauf bestimmen.",
    },
    showCards: {
      en: "Cards follow the selected scope/order/mode/page size; changes refresh the session content immediately.",
      de: "Karten folgen Scope/Order/Mode/Page Size; Aenderungen aktualisieren den Session-Inhalt sofort.",
    },
    workflow: {
      en: "Scan note → open Flashcard → adjust filters → answer cards sequentially → observe stats.",
      de: "Notiz scannen → Flashcard oeffnen → Filter anpassen → Karten nacheinander beantworten → Statistiken beobachten.",
    },
    tips: {
      en: "Reset stats for a clean run when restarting; keep filters stable when comparing results.",
      de: "Statistiken fuer einen sauberen Run zuruecksetzen; Filter stabil halten, wenn du Ergebnisse vergleichst.",
    },
  },
};
