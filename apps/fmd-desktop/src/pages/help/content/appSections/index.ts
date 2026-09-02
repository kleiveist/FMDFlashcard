/**
 * @file apps/fmd-desktop/src/pages/help/content/appSections/index.ts
 *
 * Purpose:
 * - Provides the "App Sections" guide content for Help.
 */

import {
  AppSectionCategoryData,
  AppSectionCategoryId,
  AppSectionItemData,
  AppSectionItemId,
} from "../types";

export const APP_SECTION_CATEGORY_ORDER: AppSectionCategoryId[] = ["editor", "study", "monitoring"];

export const APP_SECTION_LABELS = {
  categoryLabel: { en: "Category", de: "Kategorie" },
  sectionLabel: { en: "Section", de: "Bereich" },
  typicalAction: { en: "Typical action", de: "Typische Aktion" },
  whatIs: { en: "What is it?", de: "Was ist das?" },
  purpose: { en: "What is it for?", de: "Wofür ist es?" },
  whatYouSee: { en: "What you see", de: "Was du siehst" },
  keyBehavior: { en: "Key behavior", de: "Kernverhalten" },
  workflow: { en: "Core workflow", de: "Kernablauf" },
  tips: { en: "Tips", de: "Tipps" },
  hybridActions: { en: "Hybrid actions", de: "Hybrid-Aktionen" },
};

export const APP_SECTION_CATEGORIES: Record<AppSectionCategoryId, AppSectionCategoryData> = {
  editor: {
    title: { en: "Editor", de: "Editor" },
    summary: {
      en: "Build, inspect, and refine markdown and exam content.",
      de: "Markdown- und Exam-Inhalte erstellen, prüfen und verfeinern.",
    },
    itemOrder: [
      "markdown-view-modus",
      "markdown-code-editor",
      "markdown-editor",
      "markdown-hybrid-editor",
      "exam-editor",
    ],
  },
  study: {
    title: { en: "Study", de: "Study" },
    summary: {
      en: "Run learning sessions with Exam, Flashcard, Fast Flashcard, and Repetition.",
      de: "Lernsessions mit Exam, Flashcard, Fast Flashcard und Repetition ausführen.",
    },
    itemOrder: ["exam", "flashcard", "fast-flashcard", "repetition"],
  },
  monitoring: {
    title: { en: "Monitoring", de: "Monitoring" },
    summary: {
      en: "Track card wrappers and maintain scoring profiles.",
      de: "Card-Wrapper überwachen und Scoring-Profile pflegen.",
    },
    itemOrder: ["card-monitoring", "points-profiles"],
  },
};

export const APP_SECTION_ITEMS: Record<AppSectionItemId, AppSectionItemData> = {
  "markdown-view-modus": {
    title: { en: "Markdown View Modus", de: "Markdown View Modus" },
    summary: {
      en: "Read-only rendered markdown preview for structure checks.",
      de: "Read-only Vorschau für gerendertes Markdown und Strukturprüfung.",
    },
    action: { en: "Inspect rendered output", de: "Gerenderte Ausgabe prüfen" },
    detail: {
      whatIs: {
        en: "Markdown View Modus shows rendered markdown without direct source editing.",
        de: "Markdown View Modus zeigt gerendertes Markdown ohne direkte Quelltext-Bearbeitung.",
      },
      purpose: [
        {
          en: "Validate headings, lists, tables, media, and hint formatting before a session.",
          de: "Überschriften, Listen, Tabellen, Medien und Hinweis-Formatierung vor einer Session prüfen.",
        },
        {
          en: "Quickly review how learners will see the note content.",
          de: "Schnell prüfen, wie Lernende den Notizinhalt sehen.",
        },
      ],
      whatYouSee: {
        en: "Rendered blocks, markdown styling, and media output in the Preview panel.",
        de: "Gerenderte Blöcke, Markdown-Styling und Medienausgabe im Preview-Panel.",
      },
      keyBehavior: {
        en: "No source changes are made in this mode; it is for inspection only.",
        de: "In diesem Modus werden keine Quelltextänderungen vorgenommen; er dient nur der Prüfung.",
      },
      workflow: {
        en: "Open note -> switch to Markdown View Modus -> verify output -> switch mode when edits are needed.",
        de: "Notiz öffnen -> zu Markdown View Modus wechseln -> Ausgabe prüfen -> bei Bedarf in einen Editiermodus wechseln.",
      },
      tips: {
        en: "Use it before scan or publish steps to catch formatting issues early.",
        de: "Vor Scan- oder Publish-Schritten nutzen, um Formatprobleme früh zu erkennen.",
      },
    },
  },
  "markdown-code-editor": {
    title: { en: "Markdown Code Editor", de: "Markdown Code Editor" },
    summary: {
      en: "Raw markdown editing with exact text-level control.",
      de: "Rohtext-Bearbeitung mit exakter Kontrolle auf Zeilenebene.",
    },
    action: { en: "Edit markdown source", de: "Markdown-Quelltext bearbeiten" },
    detail: {
      whatIs: {
        en: "Markdown Code Editor is the direct source mode for markdown files.",
        de: "Markdown Code Editor ist der direkte Quelltextmodus für Markdown-Dateien.",
      },
      purpose: [
        {
          en: "Perform precise edits for frontmatter, syntax markers, and structural lines.",
          de: "Präzise Änderungen an Frontmatter, Syntax-Markern und Strukturzeilen durchführen.",
        },
        {
          en: "Fix parser-sensitive details where line structure matters.",
          de: "Parser-sensitive Details korrigieren, bei denen Zeilenstruktur wichtig ist.",
        },
      ],
      whatYouSee: {
        en: "Editable raw markdown text with mode controls in the Preview toolbar.",
        de: "Editierbaren Markdown-Rohtext mit Modus-Steuerung in der Preview-Toolbar.",
      },
      keyBehavior: {
        en: "Changes affect exact file text, including spacing and marker placement.",
        de: "Änderungen betreffen den exakten Dateitext, inklusive Leerzeichen und Marker-Positionen.",
      },
      workflow: {
        en: "Open file -> switch to Markdown Code Editor -> edit source -> save -> verify in Markdown View Modus.",
        de: "Datei öffnen -> zu Markdown Code Editor wechseln -> Quelltext bearbeiten -> speichern -> in Markdown View Modus prüfen.",
      },
      tips: {
        en: "Use this mode for advanced syntax and block markers such as #card, #help, and #exam.",
        de: "Diesen Modus für fortgeschrittene Syntax und Block-Marker wie #card, #help und #exam verwenden.",
      },
    },
  },
  "markdown-editor": {
    title: { en: "Markdown Editor", de: "Markdown Editor" },
    summary: {
      en: "Main editing workspace with mode switching and tab navigation.",
      de: "Hauptarbeitsbereich mit Moduswechsel und Tab-Navigation.",
    },
    action: { en: "Work on notes", de: "An Notizen arbeiten" },
    detail: {
      whatIs: {
        en: "Markdown Editor is the central workspace for opening, editing, and validating markdown notes.",
        de: "Markdown Editor ist der zentrale Arbeitsbereich zum Öffnen, Bearbeiten und Validieren von Markdown-Notizen.",
      },
      purpose: [
        {
          en: "Combine file navigation, editing modes, and preview in one place.",
          de: "Dateinavigation, Editiermodi und Vorschau an einer Stelle kombinieren.",
        },
        {
          en: "Prepare content for Study flows and Exam Editor without leaving the workspace.",
          de: "Inhalte für Study-Flows und Exam Editor vorbereiten, ohne den Arbeitsbereich zu verlassen.",
        },
      ],
      whatYouSee: {
        en: "Preview header controls, editor mode buttons, markdown tabs, and note content.",
        de: "Preview-Header-Steuerung, Editor-Modus-Buttons, Markdown-Tabs und Notizinhalte.",
      },
      keyBehavior: {
        en: "Mode toggles switch between code, rendered markdown, and hybrid editing while staying on the same file.",
        de: "Modus-Toggles wechseln zwischen Code, gerendertem Markdown und Hybrid-Bearbeitung in derselben Datei.",
      },
      workflow: {
        en: "Select note -> choose editor mode -> edit and review -> save -> continue to Study or Exam Editor.",
        de: "Notiz auswählen -> Editor-Modus wählen -> bearbeiten und prüfen -> speichern -> mit Study oder Exam Editor fortfahren.",
      },
      tips: {
        en: "Keep related files open in tabs to reduce context switching while authoring.",
        de: "Verwandte Dateien in Tabs offen halten, um Kontextwechsel beim Erstellen zu reduzieren.",
      },
    },
  },
  "markdown-hybrid-editor": {
    title: { en: "Markdown Hybrid Editor", de: "Markdown Hybrid Editor" },
    summary: {
      en: "Block-based editing with insert menus and selection-aware formatting.",
      de: "Blockbasierte Bearbeitung mit Insert-Menü und auswahlabhängiger Formatierung.",
    },
    action: { en: "Edit by block", de: "Blockweise bearbeiten" },
    detail: {
      whatIs: {
        en: "Markdown Hybrid Editor lets you edit content block-by-block with visual controls on top of markdown.",
        de: "Markdown Hybrid Editor ermöglicht blockweises Bearbeiten mit visuellen Steuerelementen auf Markdown-Basis.",
      },
      purpose: [
        {
          en: "Speed up structural editing without losing markdown compatibility.",
          de: "Struktur-Bearbeitung beschleunigen, ohne Markdown-Kompatibilität zu verlieren.",
        },
        {
          en: "Insert templates and manage complex blocks with fewer manual syntax steps.",
          de: "Templates einfügen und komplexe Blöcke mit weniger manuellen Syntax-Schritten verwalten.",
        },
      ],
      whatYouSee: {
        en: "Block rows, insert controls, contextual menus, and inline formatting helpers.",
        de: "Block-Zeilen, Insert-Steuerung, Kontextmenüs und Inline-Formatierungshilfen.",
      },
      keyBehavior: {
        en: "Edits still resolve to markdown source; Hybrid is an interaction layer, not a separate format.",
        de: "Änderungen werden weiterhin als Markdown-Quelltext gespeichert; Hybrid ist eine Interaktionsschicht, kein eigenes Format.",
      },
      workflow: {
        en: "Switch to Markdown Hybrid Editor -> insert or edit blocks -> refine selected text -> save and verify output.",
        de: "Zu Markdown Hybrid Editor wechseln -> Blöcke einfügen oder bearbeiten -> markierten Text verfeinern -> speichern und Ausgabe prüfen.",
      },
      tips: {
        en: "Use Hybrid for fast structure work, then use Markdown Code Editor for edge-case raw tweaks.",
        de: "Hybrid für schnelle Strukturarbeit nutzen, dann Markdown Code Editor für spezielle Rohtext-Feinheiten verwenden.",
      },
      actions: [
        {
          id: "plus-actions",
          label: { en: "+ Actions", de: "+ Actions" },
          description: {
            en: "The + menu inserts new blocks above or below the current block. It includes standard blocks, structure templates, links, database templates, and advanced exam/flashcard snippets.",
            de: "Das +-Menü fügt neue Blöcke über oder unter dem aktuellen Block ein. Es enthält Standardblöcke, Struktur-Templates, Links, Datenbank-Templates sowie erweiterte Exam-/Flashcard-Snippets.",
          },
        },
        {
          id: "selected-text",
          label: { en: "Selected Text", de: "Selected Text" },
          description: {
            en: "When text is selected, a floating inline toolbar appears. It supports formatting, link actions, and inline helpers such as CD/CL wrappers.",
            de: "Wenn Text markiert ist, erscheint eine schwebende Inline-Toolbar. Sie unterstützt Formatierung, Link-Aktionen und Inline-Helfer wie CD/CL-Wrapper.",
          },
        },
        {
          id: "context-actions",
          label: { en: "Context Actions", de: "Context Actions" },
          description: {
            en: "Context actions depend on block type and cursor state. Examples include quick block controls, table actions, and mode-specific helper commands.",
            de: "Kontextaktionen hängen vom Blocktyp und Cursor-Status ab. Beispiele sind schnelle Block-Steuerung, Tabellenaktionen und modusspezifische Helferbefehle.",
          },
        },
      ],
    },
  },
  "exam-editor": {
    title: { en: "Exam Editor", de: "Exam Editor" },
    summary: {
      en: "Create and maintain structured exam files and task scoring setup.",
      de: "Strukturierte Exam-Dateien und Task-Scoring-Konfiguration erstellen und pflegen.",
    },
    action: { en: "Author exam tasks", de: "Exam-Aufgaben erstellen" },
    detail: {
      whatIs: {
        en: "Exam Editor is the dedicated workspace for structuring exam content, task order, and scoring profile mapping.",
        de: "Exam Editor ist der dedizierte Arbeitsbereich für Exam-Struktur, Aufgabenreihenfolge und Scoring-Profil-Zuordnung.",
      },
      purpose: [
        {
          en: "Design exam tasks with clear structure/content separation.",
          de: "Exam-Aufgaben mit klarer Trennung von Struktur und Inhalt gestalten.",
        },
        {
          en: "Align task order and profile usage before running an Exam session.",
          de: "Task-Reihenfolge und Profilnutzung vor einer Exam-Session abstimmen.",
        },
      ],
      whatYouSee: {
        en: "Structure/Content tabs, save controls, save path status, and task-focused editing surfaces.",
        de: "Structure/Content-Tabs, Save-Steuerung, Saved-Path-Status und taskfokussierte Bearbeitungsflächen.",
      },
      keyBehavior: {
        en: "Unsaved changes are guarded before leaving the editor to prevent accidental loss.",
        de: "Ungespeicherte Änderungen werden beim Verlassen abgesichert, um versehentlichen Verlust zu verhindern.",
      },
      workflow: {
        en: "Open exam note -> refine structure/content -> assign profile usage -> save -> start Exam run for validation.",
        de: "Exam-Notiz öffnen -> Struktur/Inhalt verfeinern -> Profilnutzung zuweisen -> speichern -> Exam-Run zur Validierung starten.",
      },
      tips: {
        en: "Keep save path and profile mapping clean to avoid run-time mismatches.",
        de: "Saved Path und Profilzuordnung sauber halten, um Laufzeit-Fehlzuordnungen zu vermeiden.",
      },
    },
  },
  exam: {
    title: { en: "Exam", de: "Exam" },
    summary: {
      en: "Run exam sessions from selected files with configurable ordering modes.",
      de: "Exam-Sessions aus ausgewählten Dateien mit konfigurierbaren Reihenfolgemodi ausführen.",
    },
    action: { en: "Start an exam run", de: "Exam-Run starten" },
    detail: {
      whatIs: {
        en: "Exam runs tasks parsed from selected files and evaluates them with run statistics and scoring results.",
        de: "Exam führt Aufgaben aus ausgewählten Dateien aus und bewertet sie mit Run-Statistiken und Scoring-Ergebnissen.",
      },
      purpose: [
        {
          en: "Train with realistic run flow including start, task solving, scoring, and history.",
          de: "Mit realistischem Ablauf trainieren: Start, Aufgabenbearbeitung, Scoring und Verlauf.",
        },
        {
          en: "Compare behavior across mode combinations (Nested, Sequential + internal shuffle, Sequential, Fully mixed).",
          de: "Verhalten über Moduskombinationen vergleichen (Nested, Sequential + internal shuffle, Sequential, Fully mixed).",
        },
      ],
      whatYouSee: {
        en: "File selection, mode controls, run summary, task runner, scoring panels, and statistics tabs.",
        de: "Dateiauswahl, Modus-Steuerung, Run-Zusammenfassung, Task Runner, Scoring-Panels und Statistik-Tabs.",
      },
      keyBehavior: {
        en: "Selected files and combination mode determine task ordering before the run starts.",
        de: "Ausgewählte Dateien und Kombinationsmodus bestimmen die Aufgabenreihenfolge vor Run-Start.",
      },
      workflow: {
        en: "Select files -> choose run profile and mode -> start run -> solve tasks -> submit/score -> review stats/history.",
        de: "Dateien auswählen -> Run-Profil und Modus wählen -> Run starten -> Aufgaben lösen -> submit/scoren -> Stats/History prüfen.",
      },
      tips: {
        en: "Use profile and mode combinations consistently when comparing score trends between runs.",
        de: "Profil- und Modus-Kombinationen konsistent halten, wenn Score-Trends zwischen Runs verglichen werden.",
      },
    },
  },
  flashcard: {
    title: { en: "Flashcard", de: "Flashcard" },
    summary: {
      en: "Classic review flow with filters and session stats.",
      de: "Klassischer Review-Flow mit Filtern und Session-Statistiken.",
    },
    action: { en: "Run a review session", de: "Review-Session ausführen" },
    detail: {
      whatIs: {
        en: "Flashcard is the standard card-review mode for daily learning loops.",
        de: "Flashcard ist der Standardmodus für tägliche Karten-Review-Loops.",
      },
      purpose: [
        {
          en: "Control learning with order, mode, page size, and scope filters.",
          de: "Lernen über Order-, Mode-, Page-Size- und Scope-Filter steuern.",
        },
        {
          en: "Track progress with per-session counters and correctness stats.",
          de: "Fortschritt über Session-Zähler und Korrektheitsstatistik verfolgen.",
        },
      ],
      whatYouSee: {
        en: "Flashcard Tools panel, review cards, navigation actions, and stats panel.",
        de: "Flashcard-Tools-Panel, Review-Karten, Navigationsaktionen und Statistik-Panel.",
      },
      keyBehavior: {
        en: "Filter changes directly update which cards appear in the active session.",
        de: "Filteränderungen aktualisieren direkt, welche Karten in der aktiven Session erscheinen.",
      },
      workflow: {
        en: "Scan notes -> configure filters -> answer cards -> navigate with shortcuts -> review session stats.",
        de: "Notizen scannen -> Filter konfigurieren -> Karten beantworten -> per Shortcuts navigieren -> Session-Stats prüfen.",
      },
      tips: {
        en: "Keep one filter setup per learning goal to make results comparable.",
        de: "Pro Lernziel ein stabiles Filter-Setup verwenden, damit Ergebnisse vergleichbar bleiben.",
      },
    },
  },
  "fast-flashcard": {
    title: { en: "Fast Flashcard", de: "Fast Flashcard" },
    summary: {
      en: "Sprint-style flashcard sessions with duration and time pressure.",
      de: "Sprintartige Flashcard-Sessions mit Dauersteuerung und Zeitdruck.",
    },
    action: { en: "Run a timed sprint", de: "Zeit-Sprint ausführen" },
    detail: {
      whatIs: {
        en: "Fast Flashcard is a speed-focused Study mode with short timed runs.",
        de: "Fast Flashcard ist ein geschwindigkeitsfokussierter Study-Modus mit kurzen Zeitläufen.",
      },
      purpose: [
        {
          en: "Increase retrieval speed while keeping answer quality measurable.",
          de: "Abrufgeschwindigkeit erhöhen und Antwortqualität messbar halten.",
        },
        {
          en: "Train in compact sessions using fixed durations or Auto Time.",
          de: "In kompakten Sessions mit festen Dauern oder Auto Time trainieren.",
        },
      ],
      whatYouSee: {
        en: "Fast Flashcard Tools, duration controls, timer/progress bar, card host, and sprint stats.",
        de: "Fast-Flashcard-Tools, Dauersteuerung, Timer/Fortschrittsleiste, Card Host und Sprint-Statistiken.",
      },
      keyBehavior: {
        en: "Duration and Auto Time change pacing, while card filters still define session content.",
        de: "Dauer und Auto Time steuern das Tempo, während Kartenfilter weiterhin den Session-Inhalt definieren.",
      },
      workflow: {
        en: "Scan cards -> choose duration or Auto Time -> start sprint -> answer quickly -> review sprint metrics.",
        de: "Karten scannen -> Dauer oder Auto Time wählen -> Sprint starten -> schnell antworten -> Sprint-Metriken prüfen.",
      },
      tips: {
        en: "Use consistent durations across runs to compare pace and accuracy trends.",
        de: "Für Vergleichbarkeit von Tempo und Genauigkeit konsistente Dauern über mehrere Runs nutzen.",
      },
    },
  },
  repetition: {
    title: { en: "Repetition", de: "Repetition" },
    summary: {
      en: "Spaced box-based sessions for long-term retention.",
      de: "Spaced Box-Sessions für langfristige Behaltensleistung.",
    },
    action: { en: "Run a box session", de: "Box-Session ausführen" },
    detail: {
      whatIs: {
        en: "Repetition schedules cards by box levels and revisits weak material strategically.",
        de: "Repetition plant Karten über Box-Stufen und wiederholt schwaches Material gezielt.",
      },
      purpose: [
        {
          en: "Balance workload and retention with box count, page size, and mode filtering.",
          de: "Arbeitslast und Behaltensleistung über Box-Anzahl, Page Size und Mode-Filter ausbalancieren.",
        },
        {
          en: "Track progress over time with stats and chart-based feedback.",
          de: "Fortschritt über Zeit mit Statistik- und Chart-Feedback verfolgen.",
        },
      ],
      whatYouSee: {
        en: "Spaced Repetition tools, box filters, card host, and stats/chart area.",
        de: "Spaced-Repetition-Tools, Box-Filter, Card Host und Statistik/Chart-Bereich.",
      },
      keyBehavior: {
        en: "Box settings influence queue composition and repetition depth before each session.",
        de: "Box-Einstellungen beeinflussen Queue-Zusammensetzung und Wiederholungstiefe vor jeder Session.",
      },
      workflow: {
        en: "Scan cards -> set mode/boxes/page size -> run session -> evaluate box movement and stats.",
        de: "Karten scannen -> Mode/Boxes/Page Size setzen -> Session ausführen -> Box-Bewegung und Stats auswerten.",
      },
      tips: {
        en: "Use smaller page sizes for focused correction cycles on weak boxes.",
        de: "Kleinere Page Sizes für fokussierte Korrekturzyklen in schwachen Boxen verwenden.",
      },
    },
  },
  "card-monitoring": {
    title: { en: "Card Monitoring", de: "Card Monitoring" },
    summary: {
      en: "Vault-wide inspection and staged cleanup for #card wrappers.",
      de: "Vault-weite Prüfung und gestufte Bereinigung für #card-Wrapper.",
    },
    action: { en: "Scan and stage changes", de: "Scannen und Änderungen stagen" },
    detail: {
      whatIs: {
        en: "Card Monitoring scans markdown files for #card wrappers and supports staged bulk operations.",
        de: "Card Monitoring scannt Markdown-Dateien nach #card-Wrappern und unterstützt gestufte Bulk-Operationen.",
      },
      purpose: [
        {
          en: "Identify wrapper usage quickly across folders, files, and card types.",
          de: "Wrapper-Nutzung schnell über Ordner, Dateien und Kartentypen erkennen.",
        },
        {
          en: "Stage wrapper-removal changes safely before saving.",
          de: "Wrapper-Entfernungen sicher vor dem Speichern stagen.",
        },
      ],
      whatYouSee: {
        en: "Filter bar, sortable list, staged-change controls, and save/discard actions.",
        de: "Filterleiste, sortierbare Liste, Staging-Steuerung sowie Save/Discard-Aktionen.",
      },
      keyBehavior: {
        en: "Changes are staged first and only applied to files when Save is executed.",
        de: "Änderungen werden zuerst gestaged und erst bei Save in Dateien geschrieben.",
      },
      workflow: {
        en: "Rescan -> filter/sort -> select entries -> stage wrapper changes -> save or discard staged set.",
        de: "Rescan -> filtern/sortieren -> Einträge auswählen -> Wrapper-Änderungen stagen -> gestagten Satz speichern oder verwerfen.",
      },
      tips: {
        en: "Review filtered subsets before save to avoid broad accidental changes.",
        de: "Vor Save gefilterte Teilmengen prüfen, um unbeabsichtigte breite Änderungen zu vermeiden.",
      },
    },
  },
  "points-profiles": {
    title: { en: "Points Profiles", de: "Points Profiles" },
    summary: {
      en: "Create, assign, and monitor scoring profiles for Exam tasks.",
      de: "Scoring-Profile für Exam-Tasks erstellen, zuweisen und überwachen.",
    },
    action: { en: "Maintain scoring profiles", de: "Scoring-Profile pflegen" },
    detail: {
      whatIs: {
        en: "Points Profiles manages task-based scoring presets independent from Exam Editor file text.",
        de: "Points Profiles verwaltet taskbasierte Scoring-Presets unabhängig vom Dateitext im Exam Editor.",
      },
      purpose: [
        {
          en: "Standardize scoring rules across Exam runs with reusable profiles.",
          de: "Scoring-Regeln über Exam-Runs mit wiederverwendbaren Profilen standardisieren.",
        },
        {
          en: "Monitor where each profile is assigned in markdown files.",
          de: "Überwachen, in welchen Markdown-Dateien welches Profil zugewiesen ist.",
        },
      ],
      whatYouSee: {
        en: "Profile list, profile editor form, task-point matrix, and profile-usage monitoring list.",
        de: "Profil-Liste, Profileditor-Formular, Task-Point-Matrix und Monitoring-Liste der Profilzuweisungen.",
      },
      keyBehavior: {
        en: "Profile edits are explicit and separate from Exam note edits; assignment monitoring updates via rescan.",
        de: "Profiländerungen sind explizit und getrennt von Exam-Notiz-Edits; Zuweisungs-Monitoring aktualisiert sich per Rescan.",
      },
      workflow: {
        en: "Create/select profile -> edit duration/task points -> save profile -> rescan monitoring -> verify assignments.",
        de: "Profil erstellen/auswählen -> Dauer/Task-Punkte bearbeiten -> Profil speichern -> Monitoring rescannen -> Zuweisungen prüfen.",
      },
      tips: {
        en: "Use clear profile names and default-profile strategy to reduce run-time ambiguity.",
        de: "Klare Profilnamen und eine Default-Profil-Strategie verwenden, um Laufzeit-Unklarheiten zu reduzieren.",
      },
    },
  },
};
