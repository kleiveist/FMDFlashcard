# Gesamtinhalte – Root: /home/kleif/Projects/FMDFlashcard/apps/fmd-desktop/src/pages/help

## 📝 appSections.ts — ./content/appSections.ts

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

---

## 📝 i18n.ts — ./content/i18n.ts

/**
 * @file apps/fmd-desktop/src/pages/help/content/i18n.ts
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

import { AppLanguage, LocalizedText } from "./types";

export const resolveText = (value: LocalizedText, language: AppLanguage) => {
  if (language === "de") {
    return value.de ?? value.en ?? "";
  }
  return value.en ?? value.de ?? "";
};

export const resolveList = (items: LocalizedText[] | undefined, language: AppLanguage) =>
  (items ?? [])
    .map((item) => resolveText(item, language))
    .filter((item) => item.trim() !== "");

---

## 📝 labels.ts — ./content/labels.ts

/**
 * @file apps/fmd-desktop/src/pages/help/content/labels.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Help.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Help bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export const helpHeader = {
  eyebrow: { en: "Help", de: "Hilfe" },
  title: { en: "Help", de: "Hilfe" },
  summary: {
    en: "Quick reminders for the workflow and syntax.",
    de: "Kurze Hinweise zum Workflow und zur Syntax.",
  },
};

export const helpLabels = {
  back: { en: "Back", de: "Zurueck" },
  copy: { en: "Copy", de: "Kopieren" },
  copied: { en: "Copied", de: "Kopiert" },
  copyExample: { en: "Copy example", de: "Beispiel kopieren" },
  copyPrompt: { en: "Copy LLM prompt", de: "LLM-Prompt kopieren" },
  promptTemplate: { en: "LLM prompt template", de: "LLM-Prompt-Template" },
  example: { en: "Example", de: "Beispiel" },
  rules: { en: "Rules", de: "Regeln" },
  whatItIs: { en: "What it is", de: "Was ist es" },
  mistakes: { en: "Common mistakes", de: "Haeufige Fehler" },
  markers: { en: "Markers", de: "Marker" },
  draft: { en: "Draft", de: "Entwurf" },
  openTopic: { en: "Open topic", de: "Thema oeffnen" },
};

---

## 📝 entries.ts — ./content/syntax/entries.ts

import { SyntaxEntry } from "../types";

import { separatorBlockEntry } from "./entries/separatorBlock";
import { helpBlockEntry } from "./entries/helpBlock";
import { qaClassicEntry } from "./entries/qaClassic";
import { mcSingleEntry } from "./entries/mcSingle";
import { mcMultiEntry } from "./entries/mcMulti";
import { trueFalseEntry } from "./entries/trueFalse";
import { inlineCodeMultiEntry } from "./entries/inlineCodeMulti";
import { clozeTypedEntry } from "./entries/clozeTyped";
import { clozeInlineEntry } from "./entries/clozeInline";

export const flashcardSyntaxEntries: SyntaxEntry[] = [
  separatorBlockEntry,
  helpBlockEntry,
  qaClassicEntry,
  mcSingleEntry,
  mcMultiEntry,
  trueFalseEntry,
  inlineCodeMultiEntry,
  clozeTypedEntry,
  clozeInlineEntry,
];

---

## 📝 clozeInline.ts — ./content/syntax/entries/clozeInline.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const clozeInlineEntry: SyntaxEntry = {
    id: "cloze-inline",
    title: { en: "Cloze + inline code", de: "Cloze + Inline-Code" },
    markers: ["%...%", "`token`"],
    keyRule: {
      en: "Typed cloze blanks and inline-code drag tokens can be combined.",
      de: "Cloze-Luecken und Inline-Code-Drag-Tokens koennen kombiniert werden.",
    },
    snippet: {
      en: "%Paris% and `Seine`",
      de: "%Paris% und `Seine`",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze blanks (%...%) are typed inputs, while inline code tokens (`...`) become drag blanks. You can use both in one card and combine with other syntaxes if desired.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %...% for typed cloze blanks.",
          "Use `...` for drag tokens.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard that may combine typed blanks and drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Typed blanks use %...%.",
          "- Drag tokens use `...`.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%cloze%_and_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %Paris% and the river is `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %...% segment.",
          "Forgetting backticks around a drag token.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Luecken (%...%) sind Eingabefelder, Inline-Code-Tokens (`...`) werden zu Drag-Luecken. Beides kann in einer Karte stehen und mit anderen Syntaxen kombiniert werden.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%...% fuer Cloze-Eingaben nutzen.",
          "`...` fuer Drag-Tokens nutzen.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte, die Eingabeblanks und Drag-Tokens kombinieren darf.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Eingabeblanks mit %...%.",
          "- Drag-Tokens mit `...`.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%cloze%_und_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: Die Hauptstadt von Frankreich ist %Paris% und der Fluss ist `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leere %...%-Blaenke lassen.",
          "Backticks fuer Drag-Tokens vergessen.",
        ],
      },
    },
  };

---

## 📝 clozeTyped.ts — ./content/syntax/entries/clozeTyped.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const clozeTypedEntry: SyntaxEntry = {
    id: "cloze-typed",
    title: { en: "Cloze (typed blanks)", de: "Cloze (Eingabe-Luecken)" },
    markers: ["%...%"],
    keyRule: {
      en: "%...% creates typed input blanks.",
      de: "%...% erzeugt Eingabe-Luecken.",
    },
    snippet: {
      en: "%Paris%",
      de: "%Paris%",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze cards hide parts of a sentence inside %...% and require typed input for each blank.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %...% to mark each typed blank.",
          "Each blank must have content inside the %...% markers.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard with typed blanks.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Use %...% for each blank.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%cloze%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %Paris%.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %...% segment.",
          "Forgetting to close a %...% marker.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Karten verstecken Teile eines Satzes in %...% und erwarten eine getippte Eingabe fuer jede Luecke.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%...% fuer jede Eingabe-Luecke nutzen.",
          "Jede Luecke muss Inhalt zwischen %...% haben.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte mit Eingabe-Luecken.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- %...% fuer jede Luecke nutzen.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%cloze%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Ergaenze: Die Hauptstadt von Frankreich ist %Paris%.",
          "#",
        ]),
        mistakes: [
          "Leere %...%-Luecken lassen.",
          "%...%-Marker nicht schliessen.",
        ],
      },
    },
  };

---

## 📝 helpBlock.ts — ./content/syntax/entries/helpBlock.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const helpBlockEntry: SyntaxEntry = {
  id: "help-block",
  title: { en: "Help / hint block", de: "Hilfe-/Hinweis-Block" },
  markers: ["#help", "#helpend"],
  keyRule: {
    en: "Attach optional hints inside a card/task; help never affects grading.",
    de: "Optionale Hinweise innerhalb Karte/Aufgabe; Help beeinflusst keine Bewertung.",
  },
  snippet: {
    en: "#help\nHint: {{...}}\n#helpend",
    de: "#help\nHinweis: {{...}}\n#helpend",
  },
  detail: {
    en: {
      whatItIs:
        "Use #help ... #helpend to attach non-graded hints to a flashcard (or an exam task). The parser extracts the block and excludes it from interaction detection, so markers inside help do not change the detected card type or scoring.",
      rules: [
        "Place the help block inside an open #card ... # scope (or inside an ea task scope).",
        "#help and #helpend must be on their own lines.",
        "Help content is optional UI text (hints, reminders, mini cheat-sheets).",
        "Help never changes the detected interaction type and never affects scoring/SRS.",
        "Avoid a standalone '---' line inside #help (it ends the help block early).",
        "A help block outside any card/task is ignored.",
      ],
      promptTemplate: joinLines([
        "Write exactly one flashcard in FMDFlashcard syntax.",
        "Return only the #card block.",
        "Add exactly one #help ... #helpend block with short hints.",
        "Rules:",
        "- The help block must be inside the #card block.",
        "- #help and #helpend must be on their own lines.",
        "- Do not put '---' on its own line inside #help.",
        "- Do not reveal the full solution inside the hints.",
        "Template:",
        "#card",
        "{{prompt}}",
        "{{interaction_body}}",
        "",
        "#help",
        "{{hint_intro}}",
        "- {{hint_1}}",
        "- {{hint_2}}",
        "#helpend",
        "#",
      ]),
      example: joinLines([
        "#card",
        "Which number is a prime number?",
        "a) 4",
        "b) 5",
        "c) 9",
        "-b",
        "",
        "#help",
        "Key idea: A prime has exactly two divisors (1 and itself).",
        "- Check divisibility by 2 or 3 first.",
        "- If it has another divisor, it is not prime.",
        "#helpend",
        "#",
      ]),
      mistakes: [
        "Placing #help outside any #card (it will be ignored).",
        "Forgetting #helpend (the help block may swallow following lines).",
        "Using a standalone '---' inside #help (it ends the block early).",
        "Expecting Answer:/-a/-true inside #help to count as solutions (they are ignored).",
      ],
    },
    de: {
      whatItIs:
        "Mit #help ... #helpend kannst du nicht-bewertete Hinweise an eine Flashcard (oder eine Exam-Aufgabe) haengen. Der Parser extrahiert den Block und entfernt ihn vor der Interaktions-Erkennung, daher aendert Help weder Kartentyp noch Bewertung.",
      rules: [
        "Platziere den Help-Block innerhalb eines offenen #card ... #-Scopes (oder innerhalb eines ea-Task-Scopes).",
        "#help und #helpend muessen jeweils auf eigenen Zeilen stehen.",
        "Help-Inhalt ist optionaler UI-Text (Hinweise, Merksaetze, Mini-Spickzettel).",
        "Help aendert weder den erkannten Interaktionstyp noch Bewertung/SRS.",
        "Vermeide eine alleinstehende '---'-Zeile innerhalb #help (beendet den Block vorzeitig).",
        "Ein Help-Block ausserhalb einer Karte/Aufgabe wird ignoriert.",
      ],
      promptTemplate: joinLines([
        "Erstelle genau eine Flashcard im FMDFlashcard-Syntaxformat.",
        "Gib nur den #card-Block zurueck.",
        "Fuege genau einen #help ... #helpend Block mit kurzen Hinweisen hinzu.",
        "Regeln:",
        "- Der Help-Block muss innerhalb des #card-Blocks stehen.",
        "- #help und #helpend muessen auf eigenen Zeilen stehen.",
        "- Schreibe '---' nicht als eigene Zeile innerhalb #help.",
        "- Keine komplette Loesung in den Hinweisen verraten.",
        "Template:",
        "#card",
        "{{frage}}",
        "{{interaktion}}",
        "",
        "#help",
        "{{hinweis_intro}}",
        "- {{hinweis_1}}",
        "- {{hinweis_2}}",
        "#helpend",
        "#",
      ]),
      example: joinLines([
        "#card",
        "Welche Zahl ist eine Primzahl?",
        "a) 4",
        "b) 5",
        "c) 9",
        "-b",
        "",
        "#help",
        "Merksatz: Eine Primzahl hat genau zwei Teiler (1 und sich selbst).",
        "- Pruefe zuerst Teilbarkeit durch 2 oder 3.",
        "- Gibt es einen weiteren Teiler, ist es keine Primzahl.",
        "#helpend",
        "#",
      ]),
      mistakes: [
        "#help ausserhalb eines #card-Blocks platzieren (wird ignoriert).",
        "#helpend vergessen (der Block kann nachfolgende Zeilen verschlucken).",
        "Eine alleinstehende '---'-Zeile innerhalb #help verwenden (beendet den Block vorzeitig).",
        "Erwarten, dass Answer:/-a/-true innerhalb #help als Loesung zaehlt (wird ignoriert).",
      ],
    },
  },
};

---

## 📝 helpers.ts — ./content/syntax/entries/helpers.ts

// Auto-generated refactor: shared helpers for syntax entries
export const joinLines = (lines: string[]) => lines.join("\n");

---

## 📝 inlineCodeMulti.ts — ./content/syntax/entries/inlineCodeMulti.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const inlineCodeMultiEntry: SyntaxEntry = {
    id: "inline-code-multi",
    title: { en: "Inline-code tokens", de: "Inline-Code-Tokens" },
    markers: ["`token`"],
    keyRule: {
      en: "Multiple `...` tokens in one line create multiple drag blanks.",
      de: "Mehrere `...`-Tokens in einer Zeile erzeugen mehrere Drag-Luecken.",
    },
    snippet: {
      en: "`git` `status`",
      de: "`git` `status`",
    },
    detail: {
      en: {
        whatItIs:
          "Inline code tokens (`...`) become draggable blanks. You can place multiple tokens in one line to create multiple blanks.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use backticks around each token.",
          "Multiple tokens per line are allowed.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one inline-code flashcard with multiple drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- Use backticks around each token.",
          "- You may include multiple tokens per line.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "{{text_with_`token_1`_and_`token_2`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Complete the command:",
          "`git` `status` shows changes.",
          "#",
        ]),
        mistakes: [
          "Using single quotes instead of backticks.",
          "Leaving a token without closing backticks.",
        ],
      },
      de: {
        whatItIs:
          "Inline-Code-Tokens (`...`) werden zu Drag-Luecken. Du kannst mehrere Tokens in einer Zeile setzen, um mehrere Luecken zu erzeugen.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Jeden Token mit Backticks markieren.",
          "Mehrere Tokens pro Zeile sind erlaubt.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Inline-Code-Karte mit mehreren Drag-Tokens.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Tokens mit Backticks markieren.",
          "- Mehrere Tokens pro Zeile sind erlaubt.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "{{text_mit_`token_1`_und_`token_2`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Vervollstaendige den Befehl:",
          "`git` `status` zeigt Aenderungen.",
          "#",
        ]),
        mistakes: [
          "Einfache Anfuehrungszeichen statt Backticks nutzen.",
          "Token ohne schliessende Backticks.",
        ],
      },
    },
  };

---

## 📝 mcMulti.ts — ./content/syntax/entries/mcMulti.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const mcMultiEntry: SyntaxEntry = {
    id: "mc-multi",
    title: {
      en: "Multiple choice (Multiple Answers)",
      de: "Multiple Choice (mehrere Antworten)",
    },
    markers: ["a)", "b)", "c)", "-a", "-c"],
    keyRule: {
      en: "At least two options; multiple correct markers allowed.",
      de: "Mindestens zwei Optionen; mehrere korrekte Marker erlaubt.",
    },
    detail: {
      en: {
        whatItIs:
          "A multiple choice card with more than one correct option. Label options as a), b), c) and list every correct marker on its own line.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Provide at least two options labeled a), b), c) ...",
          "Allow multiple correct markers (-a, -b, -c).",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one multiple choice flashcard with multiple correct answers.",
          "Return only the #card block.",
          "Rules:",
          "- Prompt on the first non-empty line.",
          "- Options labeled a), b), c)...",
          "- List every correct marker on its own line.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{correct_letter_1}}",
          "-{{correct_letter_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Which numbers are prime?",
          "a) 2",
          "b) 4",
          "c) 5",
          "-a",
          "-c",
          "#",
        ]),
        mistakes: [
          "Using only one correct marker for a multi-answer prompt.",
          "Forgetting to mark all correct options.",
        ],
      },
      de: {
        whatItIs:
          "Eine Multiple-Choice-Karte mit mehreren richtigen Antworten. Optionen als a), b), c) schreiben und alle korrekten Marker jeweils in einer eigenen Zeile angeben.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Mindestens zwei Optionen mit a), b), c) ...",
          "Mehrere korrekte Marker erlaubt (-a, -b, -c).",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Multiple-Choice-Karte mit mehreren richtigen Antworten.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Frage in der ersten nicht-leeren Zeile.",
          "- Optionen als a), b), c)...",
          "- Alle korrekten Marker jeweils in eigener Zeile.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{korrekt_1}}",
          "-{{korrekt_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Welche Zahlen sind prim?",
          "a) 2",
          "b) 4",
          "c) 5",
          "-a",
          "-c",
          "#",
        ]),
        mistakes: [
          "Nur einen Marker setzen, obwohl mehrere Antworten richtig sind.",
          "Nicht alle korrekten Optionen markieren.",
        ],
      },
    },
  };

---

## 📝 mcSingle.ts — ./content/syntax/entries/mcSingle.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const mcSingleEntry: SyntaxEntry = {
    id: "mc-single",
    title: { en: "Multiple choice (Single Answer)", de: "Multiple Choice (eine Antwort)" },
    markers: ["a)", "b)", "c)", "-a"],
    keyRule: {
      en: "At least two options, exactly one correct marker (-a, -b, ...).",
      de: "Mindestens zwei Optionen, genau ein korrekter Marker (-a, -b, ...).",
    },
    snippet: {
      en: "a) {{option_a}}\n-b",
      de: "a) {{option_a}}\n-b",
    },
    detail: {
      en: {
        whatItIs:
          "A multiple choice card with exactly one correct option. Label options as a), b), c) and mark the correct option with a single -a, -b, or -c line.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Provide at least two options labeled a), b), c) ...",
          "Include exactly one correct marker (-a, -b, ...).",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one multiple choice flashcard with a single correct answer.",
          "Return only the #card block.",
          "Rules:",
          "- Prompt on the first non-empty line.",
          "- Options labeled a), b), c)...",
          "- Exactly one correct marker (-a, -b, ...).",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{correct_letter}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Which planet is known as the Red Planet?",
          "a) Earth",
          "b) Mars",
          "c) Venus",
          "-b",
          "#",
        ]),
        mistakes: [
          "Marking more than one correct option.",
          "Using option labels without a correct marker.",
        ],
      },
      de: {
        whatItIs:
          "Eine Multiple-Choice-Karte mit genau einer richtigen Antwort. Optionen als a), b), c) schreiben und genau einen Marker -a, -b oder -c setzen.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Mindestens zwei Optionen mit a), b), c) ...",
          "Genau einen korrekten Marker setzen (-a, -b, ...).",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Multiple-Choice-Karte mit genau einer richtigen Antwort.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Frage in der ersten nicht-leeren Zeile.",
          "- Optionen als a), b), c)...",
          "- Genau ein korrekter Marker (-a, -b, ...).",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{korrekt}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Welcher Planet ist der Rote Planet?",
          "a) Erde",
          "b) Mars",
          "c) Venus",
          "-b",
          "#",
        ]),
        mistakes: [
          "Mehrere richtige Marker setzen.",
          "Keine Option als richtig markieren.",
        ],
      },
    },
  };

---

## 📝 qaClassic.ts — ./content/syntax/entries/qaClassic.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const qaClassicEntry: SyntaxEntry = {
    id: "qa-classic",
    title: { en: "Classic Q&A", de: "Klassische Q&A" },
    markers: ["Answer:", "Antwort:"],
    keyRule: {
      en: "Answer:/Antwort: splits front and back; answers can be multiline.",
      de: "Answer:/Antwort: trennt Vorder- und Rueckseite; Antworten koennen mehrzeilig sein.",
    },
    snippet: {
      en: "Answer: {{answer}}",
      de: "Antwort: {{antwort}}",
    },
    detail: {
      en: {
        whatItIs:
          "Use a direct question on the first non-empty line and provide the answer after the Answer: marker. The answer may be inline or on the following lines. Answer: and Antwort: behave identically; only the label language changes.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Start the answer with Answer: (or Antwort:) inside the block.",
          "Answer: and Antwort: behave identically; only the label language changes.",
          "Do not mix with other card types.",
        ],
        promptTemplate: joinLines([
          "Write exactly one flashcard in FMDFlashcard syntax.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Use Answer: (or Antwort:) to start the answer.",
          "- Do not mix with other card types.",
          "Template:",
          "#card",
          "{{prompt}}",
          "Answer: {{answer}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "What is SQL?",
          "Answer: A language for querying databases.",
          "#",
        ]),
        mistakes: [
          "Placing Answer: before the prompt.",
          "Putting #card and # on the same line.",
          "Mixing with multiple choice or true/false.",
        ],
      },
      de: {
        whatItIs:
          "Nutze eine direkte Frage in der ersten nicht-leeren Zeile und schreibe die Antwort nach dem Marker Antwort: (oder Answer:). Die Antwort darf in derselben Zeile oder in den folgenden Zeilen stehen. Answer: und Antwort: verhalten sich identisch; nur die Sprache des Labels aendert sich.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Antwort mit Antwort: (oder Answer:) starten.",
          "Answer: und Antwort: verhalten sich identisch; nur die Sprache des Labels aendert sich.",
          "Nicht mit anderen Kartentypen mischen.",
        ],
        promptTemplate: joinLines([
          "Erstelle genau eine Karte in FMDFlashcard-Syntax.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Starte die Antwort mit Antwort: (oder Answer:).",
          "- Nicht mit anderen Kartentypen mischen.",
          "Template:",
          "#card",
          "{{frage}}",
          "Antwort: {{antwort}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Was ist SQL?",
          "Antwort: Eine Sprache zum Abfragen von Datenbanken.",
          "#",
        ]),
        mistakes: [
          "Antwort: vor die Frage setzen.",
          "#card und # in derselben Zeile schreiben.",
          "Mit Multiple Choice oder True/False mischen.",
        ],
      },
    },
  };

---

## 📝 separatorBlock.ts — ./content/syntax/entries/separatorBlock.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const separatorBlockEntry: SyntaxEntry = {
    id: "separator-block",
    title: { en: "Structured separator block", de: "Strukturierter Separator-Block" },
    markers: ["---", "#card", "#"],
    keyRule: {
      en: "Use --- to wrap cards; only #card/# defines card content.",
      de: "--- kann Karten umrahmen; nur #card/# definiert Karteninhalt.",
    },
    snippet: {
      en: "---\n#card",
      de: "---\n#card",
    },
    detail: {
      en: {
        whatItIs:
          "Markdown separators (---) can wrap card blocks to structure notes. The parser still relies on #card and #; text outside the block is ignored.",
        rules: [
          "Use --- on its own lines if you want separators.",
          "Cards still require #card and # on their own lines.",
          "Content outside #card/# is ignored.",
          "Do not expect --- to start or end a card by itself.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        rulesNote:
          "Cards must be wrapped with #card and #. The first non-empty line is the question. The remaining lines define the card type (options, blanks, or Answer/Antwort marker). Workflow: Makedon -> select note -> scan -> review (via Flashcard Tools or Spaced Repetition).",
        promptTemplate: joinLines([
          "Create one flashcard and optionally wrap it with markdown separators.",
          "Return only the #card block (and optional --- lines).",
          "Rules:",
          "- #card/# define the card.",
          "- --- is optional and must be on its own lines.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "---",
          "#card",
          "{{prompt}}",
          "Answer: {{answer}}",
          "#",
          "---",
        ]),
        example: joinLines([
          "---",
          "#card",
          "Define CPU.",
          "Answer: The central processing unit.",
          "#",
          "---",
        ]),
        mistakes: [
          "Using --- without #card/#.",
          "Placing --- inside the #card block.",
        ],
      },
      de: {
        whatItIs:
          "Markdown-Trennlinien (---) koennen Kartenbloecke optisch gruppieren. Der Parser nutzt weiterhin #card und #; Text ausserhalb wird ignoriert.",
        rules: [
          "--- nur als eigene Zeile verwenden.",
          "Karten brauchen weiterhin #card und # auf eigenen Zeilen.",
          "Inhalt ausserhalb #card/# wird ignoriert.",
          "--- ersetzt keine #card/#-Markierung.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        rulesNote:
          "Karten muessen mit #card und # umschlossen sein. Die erste nicht-leere Zeile ist die Frage. Die restlichen Zeilen definieren den Kartentyp (Optionen, Luecken oder Answer-/Antwort-Marker). Workflow: Makedon -> Notiz waehlen -> scannen -> wiederholen (ueber Flashcard Tools oder Spaced Repetition).",
        promptTemplate: joinLines([
          "Erstelle eine Karte und umrahme sie optional mit Markdown-Trennlinien.",
          "Antworte nur mit dem #card-Block (und optional ---).",
          "Regeln:",
          "- #card/# definieren die Karte.",
          "- --- ist optional und steht allein in der Zeile.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "---",
          "#card",
          "{{frage}}",
          "Antwort: {{antwort}}",
          "#",
          "---",
        ]),
        example: joinLines([
          "---",
          "#card",
          "Definiere CPU.",
          "Antwort: Die zentrale Verarbeitungseinheit.",
          "#",
          "---",
        ]),
        mistakes: [
          "--- ohne #card/# verwenden.",
          "--- innerhalb des #card-Blocks platzieren.",
        ],
      },
    },
  };

---

## 📝 trueFalse.ts — ./content/syntax/entries/trueFalse.ts

import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const trueFalseEntry: SyntaxEntry = {
    id: "true-false",
    title: { en: "True/False statements", de: "True/False-Aussagen" },
    markers: ["-true", "-false", "-wahr", "-falsch"],
    keyRule: {
      en: "Each statement line is followed by -true/-false (or -wahr/-falsch).",
      de: "Jede Aussage wird von -true/-false (oder -wahr/-falsch) gefolgt.",
    },
    snippet: {
      en: "Statement\n-true",
      de: "Aussage\n-true",
    },
    detail: {
      en: {
        whatItIs:
          "A statement followed by -true or -false. You can stack multiple statements in one card, as long as every statement line is immediately followed by its marker.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the first statement.",
          "Each statement line must be followed by -true/-false or -wahr/-falsch.",
          "You may stack multiple statement/marker pairs.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
          "Multilingual markers supported: -true/-false and -wahr/-falsch.",
        ],
        promptTemplate: joinLines([
          "Create one true/false flashcard, optionally with multiple statements.",
          "Return only the #card block.",
          "Rules:",
          "- Each statement line is followed by -true or -false.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "- Markers can be -true/-false or -wahr/-falsch.",
          "Template:",
          "#card",
          "{{statement_1}}",
          "-{{true_or_false_1}}",
          "{{statement_2}}",
          "-{{true_or_false_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "The Earth orbits the Sun.",
          "-true",
          "Pluto is a planet.",
          "-false",
          "#",
        ]),
        mistakes: [
          "Writing two statements and only one marker.",
          "Placing a marker without a statement line.",
        ],
      },
      de: {
        whatItIs:
          "Eine Aussage gefolgt von -true oder -false. Du kannst mehrere Aussagen stapeln, solange jede Aussage direkt ihren Marker hat.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die erste Aussage.",
          "Jede Aussage braucht direkt danach -true/-false oder -wahr/-falsch.",
          "Mehrere Aussage/Marker-Paare sind erlaubt.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Mehrsprachige Marker: -true/-false und -wahr/-falsch.",
        ],
        promptTemplate: joinLines([
          "Erstelle eine True/False-Karte, optional mit mehreren Aussagen.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Jede Aussage wird direkt von -true oder -false gefolgt.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "- Marker koennen -true/-false oder -wahr/-falsch sein.",
          "Template:",
          "#card",
          "{{aussage_1}}",
          "-{{true_oder_false_1}}",
          "{{aussage_2}}",
          "-{{true_oder_false_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Die Erde kreist um die Sonne.",
          "-true",
          "Pluto ist ein Planet.",
          "-false",
          "#",
        ]),
        mistakes: [
          "Zwei Aussagen schreiben, aber nur einen Marker setzen.",
          "Marker ohne Aussagezeile setzen.",
        ],
      },
    },
  };

---

## 📝 overview.ts — ./content/syntax/overview.ts

/**
 * @file apps/fmd-desktop/src/pages/help/content/syntax/overview.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Help.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Help bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export const flashcardSyntaxOverview = {
  title: { en: "Core rules", de: "Grundregeln" },
  bullets: [
    {
      en: "Wrap every card with #card and # on their own lines; content outside is ignored.",
      de: "Jede Karte mit #card und # auf eigenen Zeilen umschliessen; Inhalt ausserhalb wird ignoriert.",
    },
    {
      en: "The first non-empty line is the prompt.",
      de: "Die erste nicht-leere Zeile ist die Frage.",
    },
    {
      en: "Syntaxes can be combined in one #card block when desired; keep markers clear and consistent.",
      de: "Syntaxen koennen bei Bedarf in einem #card-Block kombiniert werden; Marker klar und konsistent halten.",
    },
    {
      en: "Optional #help/#helpend blocks add hints without changing card type or scoring.",
      de: "Optionale #help/#helpend-Bloecke liefern Hinweise ohne Kartentyp oder Bewertung zu aendern.",
    },
  ],
};

---

## 📝 topics.ts — ./content/topics.ts

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
      de: "Vault auswaehlen, Berechtigungen bestaetigen und typische Probleme bei leeren Listen beheben.",
    },
    sections: [
      {
        id: "vault-select",
        title: { en: "Select a vault", de: "Vault auswaehlen" },
        bullets: [
          {
            en: "Use Makedon to choose a folder and allow access when prompted; confirm the correct path.",
            de: "In Makedon einen Ordner waehlen und Zugriff erlauben; den richtigen Pfad bestaetigen.",
          },
          {
            en: "After loading, pick a note to preview and scan so cards populate the tools.",
            de: "Nach dem Laden eine Notiz waehlen, Vorschau pruefen und scannen, damit Karten geladen werden.",
          },
        ],
      },
      {
        id: "vault-issues",
        title: { en: "Common issues", de: "Haeufige Probleme" },
        bullets: [
          {
            en: "Missing permissions can block the file list or previews; re-approve access if needed.",
            de: "Fehlende Berechtigungen blockieren Dateiliste oder Vorschau; Zugriff ggf. erneut erlauben.",
          },
          {
            en: "If the list is empty, verify the path, markdown file types, and any active filters.",
            de: "Bei leerer Liste Pfad, Markdown-Dateien und aktive Filter pruefen.",
          },
          {
            en: "If the vault moved, reselect it in Makedon and scan again.",
            de: "Wenn der Vault verschoben wurde, neu in Makedon auswaehlen und erneut scannen.",
          },
        ],
      },
    ],
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

---

## 📝 types.ts — ./content/types.ts

/**
 * @file apps/fmd-desktop/src/pages/help/content/types.ts
 *
 * Zweck:
 * - Definiert Typen und Schnittstellen fuer Help.
 *
 * Verantwortlichkeiten:
 * - Definiert Typen fuer Datenstrukturen und APIs.
 * - Sichert konsistente Verwendung in Features und Komponenten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/content/appSections.ts: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/pages/help/content/i18n.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Typanpassungen koennen mehrere Module betreffen.
 */

export type AppLanguage = "de" | "en";
export type LocalizedText = { de?: string; en?: string };

export type HelpExample = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  code: string;
};

export type SyntaxDetail = {
  whatItIs: string;
  rules: string[];
  rulesNote?: string;
  promptTemplate: string;
  example: string;
  mistakes?: string[];
};

export type SyntaxEntry = {
  id: string;
  title: LocalizedText;
  markers: string[];
  keyRule: LocalizedText;
  snippet?: LocalizedText;
  detail: { en: SyntaxDetail; de: SyntaxDetail };
};

export type HelpSection = {
  id: string;
  title: LocalizedText;
  bullets?: LocalizedText[];
  examples?: HelpExample[];
  tone?: "help-block";
};

export type HelpTopic = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  sections: HelpSection[];
  draft?: boolean;
  icon?: string;
};

export type AppSectionId =
  | "dashboard"
  | "flashcard"
  | "fast-flashcard"
  | "spaced-repetition";

export type AppSectionDetail = {
  whatIs: LocalizedText;
  purpose: LocalizedText[];
  whatYouSee: LocalizedText;
  workflow: LocalizedText;
  showCards: LocalizedText;
  tips?: LocalizedText;
};

export type AppSectionData = {
  title: LocalizedText;
  summary: LocalizedText;
  action: LocalizedText;
  detail: AppSectionDetail;
};

---

## 📝 helpContent.ts — ./helpContent.ts

/**
 * @file apps/fmd-desktop/src/pages/help/helpContent.ts
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
 * - apps/fmd-desktop/src/pages/help/content/i18n.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/content/labels.ts: Seiten-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export * from "./content/types";
export * from "./content/i18n";
export * from "./content/labels";
export * from "./content/topics";
export * from "./content/appSections";
export * from "./content/syntax/overview";
export * from "./content/syntax/entries";

---

## 📝 AppSectionsGuidePanel.tsx — ./sections/AppSectionsGuidePanel.tsx

/**
 * @file apps/fmd-desktop/src/pages/help/sections/AppSectionsGuidePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite App Sections Guide Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/HelpDetailSection.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - AppSectionsGuidePanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useEffect, useState } from "react";
import {
  APP_SECTION_DATA,
  APP_SECTION_GROUND_RULES,
  APP_SECTION_LABELS,
  APP_SECTION_ORDER,
  AppLanguage,
  AppSectionId,
  resolveText,
} from "../helpContent";

type AppSectionsGuidePanelProps = {
  language: AppLanguage;
};

export const AppSectionsGuidePanel = ({ language }: AppSectionsGuidePanelProps) => {
  const [selectedSectionId, setSelectedSectionId] =
    useState<AppSectionId>("dashboard");
  const [sectionLanguage, setSectionLanguage] = useState<AppLanguage>(language);
  const selectedSection = APP_SECTION_DATA[selectedSectionId];

  useEffect(() => {
    setSectionLanguage(language);
  }, [language]);

  return (
    <div className="help-detail-sections">
      <div className="help-detail-section help-block">
        <div className="help-item-header">
          <span className="help-block-title">
            {resolveText(APP_SECTION_LABELS.groundRulesTitle, sectionLanguage)}
          </span>
        </div>
        <p className="help-syntax-text">
          {resolveText(APP_SECTION_GROUND_RULES.paragraph, sectionLanguage)}
        </p>
        <ul className="help-list">
          {APP_SECTION_GROUND_RULES.bullets.map((bullet, index) => (
            <li key={`ground-${index}`}>
              {resolveText(bullet, sectionLanguage)}
            </li>
          ))}
        </ul>
      </div>
      <div className="help-syntax-layout">
        <div className="help-syntax-cards" role="tablist">
          {APP_SECTION_ORDER.map((sectionId) => {
            const section = APP_SECTION_DATA[sectionId];
            const isActive = selectedSectionId === sectionId;
            return (
              <button
                key={sectionId}
                type="button"
                className={`help-syntax-card${isActive ? " active" : ""}`}
                onClick={() => setSelectedSectionId(sectionId)}
                role="tab"
                aria-selected={isActive}
              >
                <div className="help-syntax-card-title">
                  {resolveText(section.title, sectionLanguage)}
                </div>
                <div className="help-syntax-card-meta">
                  <span className="help-syntax-card-label">
                    {resolveText(
                      APP_SECTION_LABELS.typicalAction,
                      sectionLanguage,
                    )}
                  </span>
                  <span>{resolveText(section.action, sectionLanguage)}</span>
                </div>
                <div className="help-syntax-card-rule">
                  {resolveText(section.summary, sectionLanguage)}
                </div>
              </button>
            );
          })}
        </div>
        <div className="help-syntax-detail">
          <div className="help-syntax-detail-header">
            <div className="help-syntax-detail-title">
              {resolveText(selectedSection.title, sectionLanguage)}
            </div>
            <div className="help-syntax-lang-tabs">
              <button
                type="button"
                className={`help-syntax-lang${
                  sectionLanguage === "en" ? " active" : ""
                }`}
                onClick={() => setSectionLanguage("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={`help-syntax-lang${
                  sectionLanguage === "de" ? " active" : ""
                }`}
                onClick={() => setSectionLanguage("de")}
              >
                DE
              </button>
            </div>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.whatIs, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.whatIs, sectionLanguage)}
            </p>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.purpose, sectionLanguage)}
              </span>
            </div>
            <ul className="help-syntax-list">
              {selectedSection.detail.purpose.map((item, index) => (
                <li key={`${selectedSectionId}-purpose-${index}`}>
                  {resolveText(item, sectionLanguage)}
                </li>
              ))}
            </ul>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.whatYouSee, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.whatYouSee, sectionLanguage)}
            </p>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.showCards, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.showCards, sectionLanguage)}
            </p>
          </div>
          {selectedSection.detail.tips ? (
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">
                  {resolveText(APP_SECTION_LABELS.tips, sectionLanguage)}
                </span>
              </div>
              <p className="help-syntax-text">
                {resolveText(selectedSection.detail.tips, sectionLanguage)}
              </p>
            </div>
          ) : null}
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">
                {resolveText(APP_SECTION_LABELS.workflow, sectionLanguage)}
              </span>
            </div>
            <p className="help-syntax-text">
              {resolveText(selectedSection.detail.workflow, sectionLanguage)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

---

## 📝 HelpDetailSection.tsx — ./sections/HelpDetailSection.tsx

/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpDetailSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Detail Section.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/AppSectionsGuidePanel.tsx: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/HelpTopicSections.tsx: Seiten-Komponente.
 *
 * Exportiert:
 * - HelpDetailSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, HelpTopic, SyntaxEntry, helpLabels, resolveText } from "../helpContent";
import { AppSectionsGuidePanel } from "./AppSectionsGuidePanel";
import { HelpTopicSections } from "./HelpTopicSections";
import { SyntaxSection } from "./SyntaxSection";

type HelpDetailSectionProps = {
  titleText: string;
  activeTopic: HelpTopic;
  language: AppLanguage;
  isSyntaxTopic: boolean;
  isAppSectionsTopic: boolean;
  activeSyntax: SyntaxEntry | null;
  setActiveTopicId: (value: string | null) => void;
  setActiveSyntaxId: (value: string | null) => void;
  syntaxLanguage: AppLanguage;
  setSyntaxLanguage: (value: AppLanguage) => void;
  copyLabel: string;
  copiedLabel: string;
  copiedItemId: string | null;
  handleCopy: (text: string, copyId: string) => void;
  overviewBullets: string[];
  syntaxCopyExampleLabel: string;
  syntaxCopyPromptLabel: string;
  syntaxCopiedLabel: string;
  syntaxPromptLabel: string;
  syntaxExampleLabel: string;
  syntaxRulesLabel: string;
  syntaxWhatItIsLabel: string;
  syntaxMistakesLabel: string;
  syntaxMarkersLabel: string;
};

export const HelpDetailSection = ({
  titleText,
  activeTopic,
  language,
  isSyntaxTopic,
  isAppSectionsTopic,
  activeSyntax,
  setActiveTopicId,
  setActiveSyntaxId,
  syntaxLanguage,
  setSyntaxLanguage,
  copyLabel,
  copiedLabel,
  copiedItemId,
  handleCopy,
  overviewBullets,
  syntaxCopyExampleLabel,
  syntaxCopyPromptLabel,
  syntaxCopiedLabel,
  syntaxPromptLabel,
  syntaxExampleLabel,
  syntaxRulesLabel,
  syntaxWhatItIsLabel,
  syntaxMistakesLabel,
  syntaxMarkersLabel,
}: HelpDetailSectionProps) => (
  <>
    <div className="help-detail-header">
      <div className="help-breadcrumb">
        <span>{titleText}</span>
        <span className="help-crumb-sep">&gt;</span>
        <span className="help-breadcrumb-current">
          {resolveText(activeTopic.title, language)}
        </span>
        {isSyntaxTopic && activeSyntax ? (
          <>
            <span className="help-crumb-sep">&gt;</span>
            <span className="help-breadcrumb-current help-breadcrumb-leaf">
              {resolveText(activeSyntax.title, syntaxLanguage)}
            </span>
          </>
        ) : null}
        {activeTopic.draft ? (
          <span className="chip">{resolveText(helpLabels.draft, language)}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="ghost small"
        onClick={() => setActiveTopicId(null)}
      >
        {resolveText(helpLabels.back, language)}
      </button>
    </div>
    <p className="muted">{resolveText(activeTopic.summary, language)}</p>
    {isSyntaxTopic ? (
      <SyntaxSection
        overviewBullets={overviewBullets}
        activeSyntax={activeSyntax}
        syntaxLanguage={syntaxLanguage}
        setActiveSyntaxId={setActiveSyntaxId}
        setSyntaxLanguage={setSyntaxLanguage}
        handleCopy={handleCopy}
        copiedItemId={copiedItemId}
        syntaxCopyExampleLabel={syntaxCopyExampleLabel}
        syntaxCopyPromptLabel={syntaxCopyPromptLabel}
        syntaxCopiedLabel={syntaxCopiedLabel}
        syntaxPromptLabel={syntaxPromptLabel}
        syntaxExampleLabel={syntaxExampleLabel}
        syntaxRulesLabel={syntaxRulesLabel}
        syntaxWhatItIsLabel={syntaxWhatItIsLabel}
        syntaxMistakesLabel={syntaxMistakesLabel}
        syntaxMarkersLabel={syntaxMarkersLabel}
      />
    ) : isAppSectionsTopic ? (
      <AppSectionsGuidePanel language={language} />
    ) : (
      <HelpTopicSections
        activeTopic={activeTopic}
        language={language}
        copiedItemId={copiedItemId}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        handleCopy={handleCopy}
      />
    )}
  </>
);

---

## 📝 HelpHeaderSection.tsx — ./sections/HelpHeaderSection.tsx

/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpHeaderSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Header Section.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/HelpPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpHeaderSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

type HelpHeaderSectionProps = {
  eyebrowText: string;
  titleText: string;
  summaryText: string;
};

export const HelpHeaderSection = ({
  eyebrowText,
  titleText,
  summaryText,
}: HelpHeaderSectionProps) => (
  <header className="content-header">
    <div>
      <p className="eyebrow">{eyebrowText}</p>
      <h1>{titleText}</h1>
      <p className="muted">{summaryText}</p>
    </div>
  </header>
);

---

## 📝 HelpOverviewSection.tsx — ./sections/HelpOverviewSection.tsx

/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpOverviewSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Overview Section.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/HelpPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpOverviewSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, HelpTopic, helpLabels, resolveText } from "../helpContent";

type HelpOverviewSectionProps = {
  helpTopics: HelpTopic[];
  language: AppLanguage;
  setActiveTopicId: (value: string | null) => void;
};

export const HelpOverviewSection = ({
  helpTopics,
  language,
  setActiveTopicId,
}: HelpOverviewSectionProps) => (
  <div className="help-overview-grid">
    {helpTopics.map((topic) => (
      <button
        key={topic.id}
        type="button"
        className="help-topic-card"
        aria-label={`${resolveText(helpLabels.openTopic, language)}: ${resolveText(
          topic.title,
          language,
        )}`}
        onClick={() => setActiveTopicId(topic.id)}
      >
        {topic.icon ? <span className="help-topic-icon">{topic.icon}</span> : null}
        <div className="help-topic-content">
          <div className="help-topic-title">{resolveText(topic.title, language)}</div>
          <div className="help-topic-summary">
            {resolveText(topic.summary, language)}
          </div>
        </div>
        {topic.draft ? (
          <span className="chip">
            {resolveText(helpLabels.draft, language)}
          </span>
        ) : null}
        <span className="help-topic-arrow">&gt;</span>
      </button>
    ))}
  </div>
);

---

## 📝 HelpTopicHeadingsBlock.tsx — ./sections/HelpTopicHeadingsBlock.tsx

/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpTopicHeadingsBlock.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Topic Headings Block.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/HelpPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpTopicHeadingsBlock: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, HelpTopic, resolveText } from "../helpContent";

type HelpTopicHeadingsBlockProps = {
  helpTopics: HelpTopic[];
  language: AppLanguage;
  activeTopicId: string;
  setActiveTopicId: (value: string | null) => void;
};

export const HelpTopicHeadingsBlock = ({
  helpTopics,
  language,
  activeTopicId,
  setActiveTopicId,
}: HelpTopicHeadingsBlockProps) => (
  <div className="pill-grid">
    {helpTopics.map((topic) => (
      <button
        key={topic.id}
        type="button"
        className={`pill pill-button${activeTopicId === topic.id ? " active" : ""}`}
        aria-pressed={activeTopicId === topic.id}
        onClick={() => setActiveTopicId(topic.id)}
      >
        {resolveText(topic.title, language)}
      </button>
    ))}
  </div>
);

---

## 📝 HelpTopicSections.tsx — ./sections/HelpTopicSections.tsx

/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpTopicSections.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Topic Sections.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/HelpDetailSection.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpTopicSections: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import {
  AppLanguage,
  HelpTopic,
  resolveList,
  resolveText,
} from "../helpContent";

type HelpTopicSectionsProps = {
  activeTopic: HelpTopic;
  language: AppLanguage;
  copiedItemId: string | null;
  copyLabel: string;
  copiedLabel: string;
  handleCopy: (text: string, copyId: string) => void;
};

export const HelpTopicSections = ({
  activeTopic,
  language,
  copiedItemId,
  copyLabel,
  copiedLabel,
  handleCopy,
}: HelpTopicSectionsProps) => (
  <div className="help-detail-sections">
    {activeTopic.sections.map((section) => {
      const bullets = resolveList(section.bullets, language);
      const examples = section.examples ?? [];
      const sectionLabelClass =
        section.tone === "help-block" ? "help-block-title" : "label";
      const sectionClassName =
        section.tone === "help-block"
          ? "help-detail-section help-block"
          : "help-detail-section";
      return (
        <div key={section.id} className={sectionClassName}>
          <div className="help-item-header">
            <span className={sectionLabelClass}>
              {resolveText(section.title, language)}
            </span>
          </div>
          {bullets.length > 0 ? (
            <ul className="help-list">
              {bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {examples.length > 0 ? (
            <div className="help-examples">
              {examples.map((example) => {
                const exampleTitle = resolveText(example.title, language);
                const exampleDescription = resolveText(
                  example.description,
                  language,
                );
                const copyId = `example-${example.id}`;
                const isCopied = copiedItemId === copyId;
                return (
                  <div key={example.id} className="help-example">
                    <div className="help-example-header">
                      <div className="help-example-text">
                        <div className="help-example-title">{exampleTitle}</div>
                        {exampleDescription ? (
                          <p className="help-example-description">
                            {exampleDescription}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="ghost small help-copy"
                        onClick={() => handleCopy(example.code, copyId)}
                        aria-label={`${copyLabel}: ${exampleTitle}`}
                      >
                        {isCopied ? copiedLabel : copyLabel}
                      </button>
                    </div>
                    <pre className="help-code">{example.code}</pre>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
);

---

## 📝 SyntaxSection.tsx — ./sections/SyntaxSection.tsx

/**
 * @file apps/fmd-desktop/src/pages/help/sections/SyntaxSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Syntax Section.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/HelpDetailSection.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - SyntaxSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import {
  AppLanguage,
  SyntaxEntry,
  flashcardSyntaxEntries,
  flashcardSyntaxOverview,
  resolveText,
} from "../helpContent";

type SyntaxSectionProps = {
  overviewBullets: string[];
  activeSyntax: SyntaxEntry | null;
  syntaxLanguage: AppLanguage;
  setActiveSyntaxId: (value: string | null) => void;
  setSyntaxLanguage: (value: AppLanguage) => void;
  handleCopy: (text: string, copyId: string) => void;
  copiedItemId: string | null;
  syntaxCopyExampleLabel: string;
  syntaxCopyPromptLabel: string;
  syntaxCopiedLabel: string;
  syntaxPromptLabel: string;
  syntaxExampleLabel: string;
  syntaxRulesLabel: string;
  syntaxWhatItIsLabel: string;
  syntaxMistakesLabel: string;
  syntaxMarkersLabel: string;
};

export const SyntaxSection = ({
  overviewBullets,
  activeSyntax,
  syntaxLanguage,
  setActiveSyntaxId,
  setSyntaxLanguage,
  handleCopy,
  copiedItemId,
  syntaxCopyExampleLabel,
  syntaxCopyPromptLabel,
  syntaxCopiedLabel,
  syntaxPromptLabel,
  syntaxExampleLabel,
  syntaxRulesLabel,
  syntaxWhatItIsLabel,
  syntaxMistakesLabel,
  syntaxMarkersLabel,
}: SyntaxSectionProps) => (
  <div className="help-detail-sections">
    <div className="help-detail-section help-block">
      <div className="help-item-header">
        <span className="help-block-title">
          {resolveText(flashcardSyntaxOverview.title, syntaxLanguage)}
        </span>
      </div>
      {overviewBullets.length > 0 ? (
        <ul className="help-list">
          {overviewBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
    <div className="help-syntax-layout">
      <div className="help-syntax-cards" role="tablist">
        {flashcardSyntaxEntries.map((entry) => {
          const isActive = entry.id === activeSyntax?.id;
          const entryTitle = resolveText(entry.title, syntaxLanguage);
          const entrySnippet = entry.snippet
            ? resolveText(entry.snippet, syntaxLanguage)
            : "";
          return (
            <button
              key={entry.id}
              type="button"
              className={`help-syntax-card${isActive ? " active" : ""}`}
              onClick={() => setActiveSyntaxId(entry.id)}
              role="tab"
              aria-selected={isActive}
            >
              <div className="help-syntax-card-title">{entryTitle}</div>
              <div className="help-syntax-card-meta">
                <span className="help-syntax-card-label">{syntaxMarkersLabel}</span>
                <div className="help-syntax-token-list">
                  {entry.markers.map((marker) => (
                    <span key={marker} className="help-syntax-token">
                      {marker}
                    </span>
                  ))}
                </div>
              </div>
              <div className="help-syntax-card-rule">
                {resolveText(entry.keyRule, syntaxLanguage)}
              </div>
              {entrySnippet ? (
                <pre className="help-syntax-snippet">{entrySnippet}</pre>
              ) : null}
            </button>
          );
        })}
      </div>
      {activeSyntax ? (
        <div className="help-syntax-detail">
          <div className="help-syntax-detail-header">
            <div className="help-syntax-detail-title">
              {resolveText(activeSyntax.title, syntaxLanguage)}
            </div>
            <div className="help-syntax-lang-tabs">
              <button
                type="button"
                className={`help-syntax-lang${
                  syntaxLanguage === "en" ? " active" : ""
                }`}
                onClick={() => setSyntaxLanguage("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={`help-syntax-lang${
                  syntaxLanguage === "de" ? " active" : ""
                }`}
                onClick={() => setSyntaxLanguage("de")}
              >
                DE
              </button>
            </div>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxWhatItIsLabel}</span>
            </div>
            <p className="help-syntax-text">
              {activeSyntax.detail[syntaxLanguage].whatItIs}
            </p>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxRulesLabel}</span>
            </div>
            {activeSyntax.detail[syntaxLanguage].rulesNote ? (
              <p className="help-syntax-text">
                {activeSyntax.detail[syntaxLanguage].rulesNote}
              </p>
            ) : null}
            <ul className="help-syntax-list">
              {activeSyntax.detail[syntaxLanguage].rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxPromptLabel}</span>
              <button
                type="button"
                className="ghost small help-copy"
                onClick={() =>
                  handleCopy(
                    activeSyntax.detail[syntaxLanguage].promptTemplate,
                    `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`,
                  )
                }
                aria-label={`${syntaxCopyPromptLabel}: ${resolveText(
                  activeSyntax.title,
                  syntaxLanguage,
                )}`}
              >
                {copiedItemId ===
                `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`
                  ? syntaxCopiedLabel
                  : syntaxCopyPromptLabel}
              </button>
            </div>
            <pre className="help-code">
              {activeSyntax.detail[syntaxLanguage].promptTemplate}
            </pre>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxExampleLabel}</span>
              <button
                type="button"
                className="ghost small help-copy"
                onClick={() =>
                  handleCopy(
                    activeSyntax.detail[syntaxLanguage].example,
                    `syntax-example-${activeSyntax.id}-${syntaxLanguage}`,
                  )
                }
                aria-label={`${syntaxCopyExampleLabel}: ${resolveText(
                  activeSyntax.title,
                  syntaxLanguage,
                )}`}
              >
                {copiedItemId ===
                `syntax-example-${activeSyntax.id}-${syntaxLanguage}`
                  ? syntaxCopiedLabel
                  : syntaxCopyExampleLabel}
              </button>
            </div>
            <pre className="help-code">
              {activeSyntax.detail[syntaxLanguage].example}
            </pre>
          </div>
          {activeSyntax.detail[syntaxLanguage].mistakes?.length ? (
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">{syntaxMistakesLabel}</span>
              </div>
              <ul className="help-syntax-list">
                {activeSyntax.detail[syntaxLanguage].mistakes?.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  </div>
);

---

