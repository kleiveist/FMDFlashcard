import { AppSectionData } from "../../types";

export const spacedRepetitionSection: AppSectionData = {
  title: { en: "Spaced Repetition", de: "Spaced Repetition" },
  summary: {
    en: "Box-based sessions with weighted order for long-term retention.",
    de: "Boxen-Sessionen mit gewichteter Reihenfolge fuer langfristige Wiederholung.",
  },
  action: { en: "Run a session", de: "Session starten" },
  detail: {
    whatIs: {
      en: "Spaced Repetition organizes cards into boxes and schedules reviews to strengthen long-term retention.",
      de: "Spaced Repetition ordnet Karten in Boxen und plant Reviews, um langfristige Behaltung zu staerken.",
    },
    purpose: [
      {
        en: "Focus practice on weak cards and space repetitions over time.",
        de: "Fokus auf schwache Karten legen und Wiederholungen ueber Zeit staffeln.",
      },
      {
        en: "Control workload via box selection, order, page size, and repetition strength.",
        de: "Arbeitslast ueber Boxenwahl, Order, Page Size und Repetition Strength steuern.",
      },
      {
        en: "Promote/demote cards based on answers so progress is reflected in the box system.",
        de: "Karten je nach Antwort befoerdern/zurueckstufen, damit Fortschritt im Box-System sichtbar wird.",
      },
    ],
    whatYouSee: {
      en: "A box overview with counts and controls that decide what is due and how the session is paced.",
      de: "Eine Box-Uebersicht mit Zaehlern und Controls, die bestimmen, was faellig ist und wie die Session laeuft.",
    },
    showCards: {
      en: "Only cards from selected boxes appear; order/page size control the queue; repetition strength shapes frequency.",
      de: "Nur Karten aus gewaehlten Boxen erscheinen; Order/Page Size steuern die Queue; Repetition Strength die Frequenz.",
    },
    workflow: {
      en: "Scan note → open Spaced Repetition → choose boxes and pacing → run session → observe box changes.",
      de: "Notiz scannen → Spaced Repetition oeffnen → Boxen und Tempo waehlen → Session laufen lassen → Boxenveraenderungen sehen.",
    },
    tips: {
      en: "Increase repetition strength when lower boxes grow; reduce it once accuracy stabilizes.",
      de: "Repetition Strength erhoehen, wenn niedrige Boxen wachsen; reduzieren, sobald die Genauigkeit stabil ist.",
    },
  },
};
