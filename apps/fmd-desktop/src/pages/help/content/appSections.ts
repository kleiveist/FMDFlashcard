/**
 * @file apps/fmd-desktop/src/pages/help/content/appSections.ts
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

import { AppSectionData, AppSectionId, LocalizedText } from "./types";

export const APP_SECTION_ORDER: AppSectionId[] = [
  "dashboard",
  "flashcard",
  "fast-flashcard",
  "spaced-repetition",
];

export const APP_SECTION_GROUND_RULES: {
  paragraph: LocalizedText;
  bullets: LocalizedText[];
} = {
  paragraph: {
    en: "Start at Makedon to pick a note and scan its cards, then use the sections below to understand how each tool manages your reviews. This quick orientation helps you decide where to continue next.",
    de: "Beginne in Makedon, wähle eine Notiz und scanne sie, dann nutze die unten stehenden Sektionen, um zu verstehen, wie jedes Tool deine Wiederholungen steuert. Diese kurze Orientierung hilft dir, den naechsten Schritt sicher zu waehlen.",
  },
  bullets: [
    {
      en: "Choose one of the four sections on the left; the detail panel updates instantly so you can keep reading without leaving the page.",
      de: "Wähle eine der vier Sektionen links; der Detailbereich aktualisiert sich sofort, damit du ohne Seitenwechsel weiterlesen kannst.",
    },
    {
      en: "The highlighted entry marks your current location and makes it easy to switch topics.",
      de: "Der markierte Eintrag zeigt dir, wo du gerade bist, und erleichtert den Wechsel zwischen Themen.",
    },
    {
      en: "Use the Back button or breadcrumb to return to the overview when you are done.",
      de: "Nutze Zurück oder die Breadcrumb, um nach dem Lesen zur Übersicht zurückzukehren.",
    },
    {
      en: "Each detail panel explains what you see, how to act, and how filtering works for that tool, step by step.",
      de: "Jeder Detailbereich beschreibt, was du siehst, welche Aktionen möglich sind und wie das Filtern in diesem Tool funktioniert, Schritt fuer Schritt.",
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
  dashboard: {
    title: { en: "Makedon", de: "Makedon" },
    summary: {
      en: "Note list, scan status, and quick previews to orient you before review.",
      de: "Notizenliste mit Scan-Status und Vorschauen, damit du dich vor dem Review orientierst.",
    },
    action: {
      en: "Pick a note",
      de: "Notiz wählen",
    },
    detail: {
      whatIs: {
        en: "Makedon shows vault notes, scan health, and shortcuts before any review. It is the starting hub where you decide what to study next.",
        de: "Makedon zeigt Vault-Notizen, Scan-Status und Schnellaktionen vor jeder Wiederholung. Es ist der Startpunkt, an dem du entscheidest, was als naechstes dran ist.",
      },
      purpose: [
        {
          en: "Choose the note you want to study and see recent scan timestamps to confirm it is up to date.",
          de: "Wähle die Notiz aus und sieh die letzten Scanzeiten, damit du weisst, ob sie aktuell ist.",
        },
        {
          en: "Trigger scans or rescans so the latest cards flow into the review tools and appear immediately.",
          de: "Starte Scans/Rescans, damit neue Karten in den Review-Tools verfuegbar sind und sofort erscheinen.",
        },
        {
          en: "Open a preview or jump directly into one of the review tools via quick actions for a faster start.",
          de: "Öffne die Vorschau oder spring per Schnellaktion direkt in ein Review-Tool, um schneller zu starten.",
        },
      ],
      whatYouSee: {
        en: "A note list with status badges, timestamps, quick actions, and filters for recently scanned items, plus quick access to previews.",
        de: "Eine Notizenliste mit Badges, Zeitstempeln, Schnellaktionen und Filtern fuer kuerzlich gescannte Notizen sowie direktem Zugang zur Vorschau.",
      },
      workflow: {
        en: "Select note → Scan/Rescan → open Flashcard/Fast Flashcard/Spaced Repetition to review.",
        de: "Notiz wählen → Scannen/Rescan → Flashcard/Fast Flashcard/Spaced Repetition öffnen und wiederholen.",
      },
      showCards: {
        en: "Scanned cards feed the three tools; adjust their filters to control the reviews and narrow the focus.",
        de: "Gescannten Karten landen in den Tools; passe deren Filter an, um die Auswahl zu steuern und den Fokus zu setzen.",
      },
      tips: {
        en: "Filter by scan status to focus on notes you just updated and avoid outdated cards.",
        de: "Filtere nach Scan-Status, um frisch bearbeitete Notizen zu priorisieren und veraltete Karten zu vermeiden.",
      },
    },
  },
  flashcard: {
    title: { en: "Flashcard", de: "Flashcard" },
    summary: {
      en: "Standard review with stats and filters to pace a focused session.",
      de: "Normale Wiederholung mit Statistiken und Filtern, damit die Session klar strukturiert bleibt.",
    },
    action: {
      en: "Start a review",
      de: "Review starten",
    },
    detail: {
      whatIs: {
        en: "Flashcard Tools deliver single-card reviews with a stats diagram, counters, and navigation. It is the classic mode for steady, deliberate practice.",
        de: "Die Flashcard Tools bieten Einzelkarten-Wiederholungen mit Diagramm, Zählern und Navigation. Das ist der klassische Modus fuer ruhiges, systematisches Lernen.",
      },
      purpose: [
        {
          en: "Answer cards while tracking accuracy and totals, so progress stays visible.",
          de: "Beantworte Karten und behalte Genauigkeit und Totale im Blick, damit der Fortschritt sichtbar bleibt.",
        },
        {
          en: "Tweak ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, solution reveal, and stats reset to shape each session and reuse settings later.",
          de: "Passe ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, Solution Reveal und Statistik-Reset an den Ablauf an und nutze diese Einstellungen erneut.",
        },
      ],
      whatYouSee: {
        en: "Card view with submission buttons, counters, stats diagram, and Flashcard Tools controls for order, scope, and mode.",
        de: "Kartenbereich mit Abgabe, Zählern, Diagramm und Flashcard Tools-Schaltern fuer Order, Scope und Mode.",
      },
      workflow: {
        en: "Scan note → open Flashcard → adjust filters → answer sequentially and watch stats update.",
        de: "Notiz scannen → Flashcard öffnen → Filter anpassen → Karten nacheinander beantworten und Statistiken verfolgen.",
      },
      showCards: {
        en: "Cards respect the selected scope/order/mode/page size; changes refresh the content instantly and update the order.",
        de: "Die Karten folgen Scope, Order, Mode und Page Size; Anpassungen aktualisieren sofort und passen die Reihenfolge an.",
      },
      tips: {
        en: "Use solution reveal for tricky cards and reset stats when restarting a session for a clean run.",
        de: "Nutze Solution Reveal bei schwierigen Karten und setze Statistiken zurück, wenn du eine Session sauber neu starten willst.",
      },
    },
  },
  "fast-flashcard": {
    title: { en: "Fast Flashcard", de: "Fast Flashcard" },
    summary: {
      en: "Timed sprints with duration pills and scoring for quick practice.",
      de: "Zeitgesteuerte Sprints mit Dauer-Buttons und Score fuer schnelle Uebungen.",
    },
    action: {
      en: "Start the timer",
      de: "Timer starten",
    },
    detail: {
      whatIs: {
        en: "Fast Flashcard wraps cards in a timer, momentum cards, and a duration-weighted score. It rewards speed while still tracking accuracy.",
        de: "Fast Flashcard kombiniert Karten mit Timer, Momentum-Karten und dauergewichteten Punkten. Es belohnt Tempo und misst zugleich die Genauigkeit.",
      },
      purpose: [
        {
          en: "Practice fast repetitions and measure pace/accuracy across short runs.",
          de: "Trainiere schnelle Wiederholungen und messe Tempo/Genauigkeit ueber kurze Laeufe.",
        },
        {
          en: "Compare session stats via the history panel to see trends over time.",
          de: "Vergleiche Sessions ueber den Verlauf, um Trends ueber die Zeit zu erkennen.",
        },
      ],
      whatYouSee: {
        en: "Timer block, stats diagram, session momentum cards (Cards/Accuracy/Pace/Score), flashcard list, submission outcome pill, and duration pills alongside ORDER/MODE/DEFAULT SCOPE for quick setup.",
        de: "Timer, Diagramm, Session-Karten, Kartenliste, Submit-Ergebnis und Fast Flashcard Tools mit Dauer-Buttons sowie ORDER/MODE/DEFAULT SCOPE fuer schnelles Setup.",
      },
      workflow: {
        en: "Scan note → choose duration → start Fast Flashcard → submit before time ends and continue with the next card.",
        de: "Notiz scannen → Dauer wählen → Fast Flashcard starten → vor Ablauf abgeben und mit der naechsten Karte weitermachen.",
      },
      showCards: {
        en: "Cards follow Fast Flashcard filters; adjust ORDER, MODE, DEFAULT SCOPE, and duration pills to tweak pacing and difficulty.",
        de: "Die Karten folgen Fast Flashcard-Filtern; ändere ORDER, MODE, DEFAULT SCOPE und Dauer-Buttons, um Tempo und Schwierigkeit zu steuern.",
      },
      tips: {
        en: "Stop the timer between runs to reset session stats without affecting history and keep comparisons clean.",
        de: "Pause den Timer zwischen Läufen, um Session-Stats zu resetten ohne den Verlauf zu beeinflussen und Vergleiche sauber zu halten.",
      },
    },
  },
  "spaced-repetition": {
    title: { en: "Spaced Repetition", de: "Spaced Repetition" },
    summary: {
      en: "Box-based sessions with weighted order for long-term retention.",
      de: "Boxen-Sessionen mit gewichteter Reihenfolge fuer langfristige Wiederholung.",
    },
    action: {
      en: "Run a session",
      de: "Session starten",
    },
    detail: {
      whatIs: {
        en: "Spaced Repetition fits cards into Leitner boxes and runs adjustable sessions for retention. It focuses practice on weaker cards and spaces repeats over time.",
        de: "Spaced Repetition ordnet Karten in Leitner-Boxen und fuehrt einstellbare Sessions durch. Der Fokus liegt auf schwachen Karten und gestaffelten Wiederholungen.",
      },
      purpose: [
        {
          en: "Focus on difficult cards by selecting specific boxes and controlling the mix.",
          de: "Fokussiere schwierige Karten ueber Boxenauswahl und steuere die Mischung.",
        },
        {
          en: "Choose order, page size, and repetition strength for pacing and workload.",
          de: "Waehle Order, Page Size und Repetition Strength fuer Tempo und Umfang.",
        },
        {
          en: "Let answers promote/demote cards automatically so progress is reflected in the boxes.",
          de: "Lass Antworten Karten automatisch befoerdern oder zurueckstufen, damit der Fortschritt in den Boxen sichtbar ist.",
        },
      ],
      whatYouSee: {
        en: "Box grid with counts, queue preview, and controls for order/page size/repetition strength, so you can see what is due.",
        de: "Boxen-Raster mit Zaehlern, Queue-Preview und Controls fuer Order/Page Size/Repetition Strength, damit du siehst, was ansteht.",
      },
      workflow: {
        en: "Scan note → open Spaced Repetition → pick boxes/order → run session and observe box changes.",
        de: "Notiz scannen → Spaced Repetition öffnen → Boxen/Order wählen → Session durchführen und Boxenveraenderungen beobachten.",
      },
      showCards: {
        en: "Only cards from selected boxes appear; order and page size plus repetition strength decide repetition frequency and spacing.",
        de: "Nur Karten aus gewaehlten Boxen erscheinen; Order/Page Size und Repetition Strength bestimmen Frequenz und Abstand.",
      },
      tips: {
        en: "Boost repetition strength when lower boxes need more practice, then scale back once accuracy improves.",
        de: "Erhoehe die Repetition Strength, wenn niedrigere Boxen mehr Uebung brauchen, und reduziere sie wieder, wenn die Genauigkeit steigt.",
      },
    },
  },
};
