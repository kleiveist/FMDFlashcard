import { AppSectionData } from "../../types";

export const examSection: AppSectionData = {
  title: { en: "Exam", de: "Exam" },
  summary: {
    en: "Structured exam sessions based on #exam blocks with numbered tasks.",
    de: "Strukturierte Exam-Sessionen basierend auf #exam-Bloecken mit nummerierten Aufgaben.",
  },
  action: { en: "Start an exam", de: "Exam starten" },
  detail: {
    whatIs: {
      en: "Exam runs interactive tasks extracted from #exam … #examend blocks. Each numbered task becomes one exam item.",
      de: "Exam fuehrt interaktive Aufgaben aus #exam … #examend-Bloecken aus. Jede nummerierte Aufgabe wird zu einem Exam-Item.",
    },
    purpose: [
      {
        en: "Practice test-like runs with clear task boundaries and predictable grading behavior.",
        de: "Pruefungsnahe Runs mit klaren Aufgaben-Grenzen und nachvollziehbarer Bewertung ueben.",
      },
      {
        en: "Bundle multiple tasks into one session without mixing them into standard review flows.",
        de: "Mehrere Aufgaben zu einer Session buendeln, ohne sie in Standard-Reviews zu vermischen.",
      },
      {
        en: "Keep long notes structured by using numbered tasks and separators.",
        de: "Lange Notizen durch nummerierte Aufgaben und Separatoren sauber strukturieren.",
      },
    ],
    whatYouSee: {
      en: "A run view driven by detected exam tasks: current task, navigation, and run-level status (ready, progress, grading).",
      de: "Eine Run-Ansicht basierend auf erkannten Exam-Tasks: aktuelle Aufgabe, Navigation und Run-Status (ready, progress, grading).",
    },
    showCards: {
      en: "Only content inside #exam blocks is considered; tasks start at numbered lines and end at --- or the next number.",
      de: "Nur Inhalt innerhalb #exam-Bloecken zaehlt; Tasks starten bei nummerierten Zeilen und enden bei --- oder der naechsten Nummer.",
    },
    workflow: {
      en: "Write #exam block → add numbered tasks → scan note → open Exam → run tasks → submit and grade.",
      de: "#exam-Block schreiben → nummerierte Tasks anlegen → Notiz scannen → Exam oeffnen → Tasks bearbeiten → abgeben und bewerten.",
    },
    tips: {
      en: "Keep one interaction type per task (qa/tf/m1/m2/cl/cd). If you must combine, split parts with --- to keep grading reliable.",
      de: "Pro Task nur einen Interaktionstyp (qa/tf/m1/m2/cl/cd). Wenn Kombination noetig ist: Teile mit --- trennen, damit Bewertung stabil bleibt.",
    },
  },
};
