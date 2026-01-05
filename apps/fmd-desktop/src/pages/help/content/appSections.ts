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
    en: "Start at the Dashboard to pick a note and scan its cards, then use the sections below to understand how each tool manages your reviews.",
    de: "Beginne im Dashboard, wähle eine Notiz und scanne sie, dann nutze die unten stehenden Sektionen, um zu verstehen, wie jedes Tool deine Wiederholungen steuert.",
  },
  bullets: [
    {
      en: "Choose one of the four sections on the left; the detail panel updates instantly.",
      de: "Wähle eine der vier Sektionen links; der Detailbereich aktualisiert sich sofort.",
    },
    {
      en: "The highlighted entry marks your current location.",
      de: "Der markierte Eintrag zeigt dir, wo du gerade bist.",
    },
    {
      en: "Use the Back button or breadcrumb to return to the overview.",
      de: "Nutze Zurück oder die Breadcrumb, um zur Übersicht zurückzukehren.",
    },
    {
      en: "Each detail panel explains what you see, how to act, and how filtering works for that tool.",
      de: "Jeder Detailbereich beschreibt, was du siehst, welche Aktionen möglich sind und wie das Filtern in diesem Tool funktioniert.",
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
    title: { en: "Dashboard", de: "Dashboard" },
    summary: {
      en: "Note list, scan status, and quick previews.",
      de: "Notizenliste mit Scan-Status und Vorschauen.",
    },
    action: {
      en: "Pick a note",
      de: "Notiz wählen",
    },
    detail: {
      whatIs: {
        en: "Dashboard shows vault notes, scan health, and shortcuts before any review.",
        de: "Das Dashboard zeigt Vault-Notizen, Scan-Status und Schnellaktionen vor jeder Wiederholung.",
      },
      purpose: [
        {
          en: "Choose the note you want to study and see recent scan timestamps.",
          de: "Wähle die Notiz aus und sieh die letzten Scanzeiten.",
        },
        {
          en: "Trigger scans or rescans so the latest cards flow into the review tools.",
          de: "Starte Scans/Rescans, damit neue Karten in den Review-Tools verfügbar sind.",
        },
        {
          en: "Open a preview or jump directly into one of the review tools via quick actions.",
          de: "Öffne die Vorschau oder spring direkt in ein Review-Tool.",
        },
      ],
      whatYouSee: {
        en: "A note list with status badges, timestamps, quick actions, and filters for recently scanned items.",
        de: "Eine Notizenliste mit Badges, Zeitstempeln, Schnellaktionen und Filtern für kürzliche Scans.",
      },
      workflow: {
        en: "Select note → Scan/Rescan → open Flashcard/Fast Flashcard/Spaced Repetition.",
        de: "Notiz wählen → Scannen/Rescan → Flashcard/Fast Flashcard/Spaced Repetition öffnen.",
      },
      showCards: {
        en: "Scanned cards feed the three tools; adjust their filters to control the reviews.",
        de: "Gescannten Karten landen in den Tools; passe deren Filter an, um die Auswahl zu steuern.",
      },
      tips: {
        en: "Filter by scan status to focus on notes you just updated.",
        de: "Filtere nach Scan-Status, um frisch bearbeitete Notizen zu priorisieren.",
      },
    },
  },
  flashcard: {
    title: { en: "Flashcard", de: "Flashcard" },
    summary: {
      en: "Standard review with stats and filters.",
      de: "Normale Wiederholung mit Statistiken und Filtern.",
    },
    action: {
      en: "Start a review",
      de: "Review starten",
    },
    detail: {
      whatIs: {
        en: "Flashcard Tools deliver single-card reviews with a stats diagram, counters, and navigation.",
        de: "Die Flashcard Tools bieten Einzelkarten-Wiederholungen mit Diagramm, Zählern und Navigation.",
      },
      purpose: [
        {
          en: "Answer cards while tracking accuracy and totals.",
          de: "Beantworte Karten und behalte Genauigkeit und Totale im Blick.",
        },
        {
          en: "Tweak ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, solution reveal, and stats reset to shape each session.",
          de: "Passe ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, Solution Reveal und Statistik-Reset an den Ablauf an.",
        },
      ],
      whatYouSee: {
        en: "Card view with submission buttons, counters, stats diagram, and Flashcard Tools controls.",
        de: "Kartenbereich mit Abgabe, Zählern, Diagramm und Flashcard Tools-Schaltern.",
      },
      workflow: {
        en: "Scan note → open Flashcard → adjust filters → answer sequentially.",
        de: "Notiz scannen → Flashcard öffnen → Filter anpassen → Karten nacheinander beantworten.",
      },
      showCards: {
        en: "Cards respect the selected scope/order/mode/page size; changes refresh the content instantly.",
        de: "Die Karten folgen Scope, Order, Mode und Page Size; Anpassungen aktualisieren sofort.",
      },
      tips: {
        en: "Use solution reveal for tricky cards and reset stats when restarting a session.",
        de: "Nutze Solution Reveal bei schwierigen Karten und setze Statistiken zurück bei Neustarts.",
      },
    },
  },
  "fast-flashcard": {
    title: { en: "Fast Flashcard", de: "Fast Flashcard" },
    summary: {
      en: "Timed sprints with duration pills and scoring.",
      de: "Zeitgesteuerte Sprints mit Dauer-Buttons und Score.",
    },
    action: {
      en: "Start the timer",
      de: "Timer starten",
    },
    detail: {
      whatIs: {
        en: "Fast Flashcard wraps cards in a timer, momentum cards, and a duration-weighted score.",
        de: "Fast Flashcard kombiniert Karten mit Timer, Momentum-Karten und dauergewichteten Punkten.",
      },
      purpose: [
        {
          en: "Practice fast repetitions and measure pace/accuracy.",
          de: "Trainiere schnelle Wiederholungen und messe Tempo/Genauigkeit.",
        },
        {
          en: "Compare session stats via the history panel.",
          de: "Vergleiche Sessions über den Verlauf.",
        },
      ],
      whatYouSee: {
        en: "Timer block, stats diagram, session momentum cards (Cards/Accuracy/Pace/Score), flashcard list, submission outcome pill, and duration pills alongside ORDER/MODE/DEFAULT SCOPE.",
        de: "Timer, Diagramm, Session-Karten, Kartenliste, Submit-Ergebnis und Fast Flashcard Tools mit Dauer-Buttons sowie ORDER/MODE/DEFAULT SCOPE.",
      },
      workflow: {
        en: "Scan note → choose duration → start Fast Flashcard → submit before time ends.",
        de: "Notiz scannen → Dauer wählen → Fast Flashcard starten → vor Ablauf abgeben.",
      },
      showCards: {
        en: "Cards follow Fast Flashcard filters; adjust ORDER, MODE, DEFAULT SCOPE, and duration pills to tweak pacing.",
        de: "Die Karten folgen Fast Flashcard-Filtern; ändere ORDER, MODE, DEFAULT SCOPE und Dauer-Buttons fürs Tempo.",
      },
      tips: {
        en: "Stop the timer between runs to reset session stats without affecting history.",
        de: "Pause den Timer zwischen Läufen, um Session-Stats zu resetten ohne den Verlauf zu beeinflussen.",
      },
    },
  },
  "spaced-repetition": {
    title: { en: "Spaced Repetition", de: "Spaced Repetition" },
    summary: {
      en: "Box-based sessions with weighted order.",
      de: "Boxen-Sessionen mit gewichteter Reihenfolge.",
    },
    action: {
      en: "Run a session",
      de: "Session starten",
    },
    detail: {
      whatIs: {
        en: "Spaced Repetition fits cards into Leitner boxes and runs adjustable sessions for retention.",
        de: "Spaced Repetition ordnet Karten in Leitner-Boxen und fuehrt einstellbare Sessions durch.",
      },
      purpose: [
        {
          en: "Focus on difficult cards by selecting specific boxes.",
          de: "Fokussiere schwierige Karten über Boxenauswahl.",
        },
        {
          en: "Choose order, page size, and repetition strength for pacing.",
          de: "Wähle Order, Page Size und Repetition Strength fürs Tempo.",
        },
        {
          en: "Let answers promote/demote cards automatically.",
          de: "Lass Antworten Karten automatisch befördern oder zurückstufen.",
        },
      ],
      whatYouSee: {
        en: "Box grid with counts, queue preview, and controls for order/page size/repetition strength.",
        de: "Boxen-Raster mit Zählern, Queue-Preview und Controls für Order/Page Size/Repetition Strength.",
      },
      workflow: {
        en: "Scan note → open Spaced Repetition → pick boxes/order → run session.",
        de: "Notiz scannen → Spaced Repetition öffnen → Boxen/Order wählen → Session durchführen.",
      },
      showCards: {
        en: "Only cards from selected boxes appear; order and page size plus repetition strength decide repetition frequency.",
        de: "Nur Karten aus gewählten Boxen erscheinen; Order/Page Size und Repetition Strength bestimmen die Frequenz.",
      },
      tips: {
        en: "Boost repetition strength when lower boxes need more practice.",
        de: "Erhöhe die Repetition Strength, wenn niedrigere Boxen intensiver geübt werden sollen.",
      },
    },
  },
};
