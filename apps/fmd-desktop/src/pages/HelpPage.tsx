import { useEffect, useRef, useState } from "react";
import { useAppState } from "../components/AppStateProvider";

type AppLanguage = "de" | "en";
type LocalizedText = { de?: string; en?: string };

type HelpExample = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  code: string;
};

type HelpSection = {
  id: string;
  title: LocalizedText;
  bullets?: LocalizedText[];
  examples?: HelpExample[];
  tone?: "help-block";
};

type HelpTopic = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  sections: HelpSection[];
  draft?: boolean;
  icon?: string;
};

const helpHeader = {
  eyebrow: { en: "Help", de: "Hilfe" },
  title: { en: "Help", de: "Hilfe" },
  summary: {
    en: "Quick reminders for the workflow and syntax.",
    de: "Kurze Hinweise zum Workflow und zur Syntax.",
  },
};

const helpLabels = {
  back: { en: "Back", de: "Zurueck" },
  copy: { en: "Copy", de: "Kopieren" },
  copied: { en: "Copied", de: "Kopiert" },
  draft: { en: "Draft", de: "Entwurf" },
  openTopic: { en: "Open topic", de: "Thema oeffnen" },
};

const flashcardSyntaxExamples: HelpExample[] = [
  {
    id: "qa-classic",
    title: { en: "Classic Q&A card", de: "Klassische Q&A-Karte" },
    description: {
      en: "Use an Answer:/Antwort: marker to split front and back; the answer can be inline or multiline.",
      de: "Answer:/Antwort: trennt Vorder- und Rueckseite; die Antwort kann inline oder mehrzeilig sein.",
    },
    code: "#card\nWhat is SQL?\nAnswer: A language for querying databases.\n#",
  },
  {
    id: "multiple-choice",
    title: { en: "Multiple choice", de: "Multiple Choice" },
    description: {
      en: "List options as a) / b) and mark the correct choice with -a (multiple markers allowed).",
      de: "Optionen als a) / b) angeben und die richtige Wahl mit -a markieren (mehrere Marker moeglich).",
    },
    code: "#card\nQuestion line\na) Option A\nb) Option B\n-a\n#",
  },
  {
    id: "cloze-combined",
    title: { en: "Cloze with inline code", de: "Cloze mit Inline-Code" },
    description: {
      en: "%%...%% creates typed blanks, while inline code `token` becomes a drag blank; both can be combined.",
      de: "%%...%% erzeugt Eingabeblanks, Inline-Code `token` wird zum Drag-Blank; beides kann kombiniert werden.",
    },
    code:
      "#card\nFill in: The capital of France is %%Paris%% and `Seine` flows nearby.\n#",
  },
  {
    id: "true-false",
    title: { en: "True/False statement", de: "True/False-Aussage" },
    description: {
      en: "Write a statement line and follow it with -true or -false; multiple statements can be stacked in one card.",
      de: "Schreibe eine Aussage und danach -true oder -false; mehrere Aussagen koennen in einer Karte stehen.",
    },
    code: "#card\nStatement\n-true\n#",
  },
  {
    id: "qa-german",
    title: { en: "German Q&A card", de: "Deutsch: Q&A-Karte" },
    description: {
      en: "Antwort: works the same as Answer: and supports multi-line answers.",
      de: "Antwort: funktioniert wie Answer: und erlaubt mehrzeilige Antworten.",
    },
    code: "#card\n4. text?\nAntwort: textcorrect\n#",
  },
  {
    id: "true-false-de",
    title: { en: "True/False question (DE)", de: "Deutsch: True/False" },
    description: {
      en: "Use -wahr/-falsch or -true/-false for true/false prompts in any language.",
      de: "Nutze -wahr/-falsch oder -true/-false fuer True/False-Prompts in jeder Sprache.",
    },
    code: "#card\n5. 2. text? true/false?\n-true\n#",
  },
  {
    id: "inline-code-multi",
    title: { en: "Multiple inline-code tokens", de: "Mehrere Inline-Code-Tokens" },
    description: {
      en: "Each `inline code` token becomes a drag blank; multiple tokens are allowed in one line.",
      de: "Jeder `inline code`-Token wird zum Drag-Blank; mehrere Tokens pro Zeile sind moeglich.",
    },
    code: "#card\n1. text  \ntext `block` text `block` text `Tabelle` text.\n#",
  },
  {
    id: "separator-block",
    title: { en: "Structured separator block", de: "Strukturierter Separator-Block" },
    description: {
      en: "Markdown separators (---) can wrap cards; text outside #card/# is ignored.",
      de: "Markdown-Trennlinien (---) koennen Karten umrahmen; Text ausserhalb von #card/# wird ignoriert.",
    },
    code: "---\n#card\n9. text\ntext %% block %%, texte\n#\n---",
  },
  {
    id: "multiline-cloze",
    title: { en: "Multiline cloze (SQL/code)", de: "Mehrzeiliges Cloze (SQL/Code)" },
    description: {
      en: "Cloze blanks can span multiple lines, and inline-code tokens still work in the same card.",
      de: "Cloze-Blaenke funktionieren ueber mehrere Zeilen; Inline-Code-Tokens sind im selben Card-Block erlaubt.",
    },
    code:
      "---\n#card\n1. text\n%% SELECT %% RechnungID, KundeID, Betrag\n%% FROM %% `RECHNUNG`\n%% WHERE %% `Betrag > 100`\n%% ORDER BY %% `Betrag DESC;`\n---\n#",
  },
];

const helpTopics: HelpTopic[] = [
  {
    id: "create-flashcards",
    title: { en: "Create flashcards", de: "Karteikarten erstellen" },
    summary: {
      en: "Define cards in markdown and scan them for review.",
      de: "Karten in Markdown definieren und fuer die Wiederholung scannen.",
    },
    sections: [
      {
        id: "create-basics",
        title: { en: "Basics", de: "Grundlagen" },
        bullets: [
          {
            en: "Wrap each card with #card and #.",
            de: "Jede Karte mit #card und # umschliessen.",
          },
          {
            en: "The first non-empty line becomes the prompt.",
            de: "Die erste nicht-leere Zeile ist die Frage.",
          },
          {
            en: "Add options, blanks, or an Answer/Antwort marker inside the block.",
            de: "Optionen, Luecken oder einen Answer-/Antwort-Marker im Block angeben.",
          },
        ],
      },
      {
        id: "create-workflow",
        title: { en: "Workflow", de: "Workflow" },
        bullets: [
          {
            en: "Dashboard -> select a note -> scan -> review (Flashcard Tools or Spaced Repetition Tools).",
            de: "Dashboard -> Notiz waehlen -> scannen -> wiederholen (Flashcard Tools oder Spaced Repetition Tools).",
          },
        ],
      },
    ],
  },
  {
    id: "flashcard-syntax",
    title: { en: "Flashcard syntax", de: "Karteikarten-Syntax" },
    summary: {
      en: "Complete syntax reference with examples for every supported card type.",
      de: "Komplette Syntax-Referenz mit Beispielen fuer alle Kartentypen.",
    },
    sections: [
      {
        id: "syntax-help",
        title: {
          en: "Quick reminders for this workflow.",
          de: "Quick reminders for this workflow.",
        },
        tone: "help-block",
        bullets: [
          {
            en: "Wrap every card with #card and # on their own lines; content outside is ignored.",
            de: "Jede Karte mit #card und # auf eigenen Zeilen umschliessen; Inhalt ausserhalb wird ignoriert.",
          },
          {
            en: "The first non-empty line is the prompt; the rest defines the card type.",
            de: "Die erste nicht-leere Zeile ist die Frage; der Rest definiert den Kartentyp.",
          },
          {
            en: "Cloze input blanks (%%...%%) and inline-code drag tokens (`...`) can be combined in one #card; other formats should be used alone.",
            de: "Cloze-Eingabeblanks (%%...%%) und Inline-Code-Drag-Tokens (`...`) koennen in einer #card kombiniert werden; andere Formate sollten getrennt bleiben.",
          },
        ],
      },
      {
        id: "syntax-examples",
        title: { en: "EXAMPLES", de: "EXAMPLES" },
        examples: flashcardSyntaxExamples,
      },
    ],
  },
  {
    id: "spaced-repetition",
    title: { en: "Spaced Repetition Tools", de: "Spaced Repetition Tools" },
    summary: {
      en: "Leitner boxes, progression, and session flow.",
      de: "Leitner-Boxen, Fortschritt und Session-Ablauf.",
    },
    sections: [
      {
        id: "sr-boxes",
        title: { en: "Leitner boxes", de: "Leitner-Boxen" },
        bullets: [
          {
            en: "3/5/8 boxes represent learning stages.",
            de: "3/5/8 Boxen bilden Lernstufen ab.",
          },
          {
            en: "Cards in the last box are excluded from sessions.",
            de: "Karten in der letzten Box werden nicht angezeigt.",
          },
        ],
      },
      {
        id: "sr-progression",
        title: { en: "Progression", de: "Fortschritt" },
        bullets: [
          {
            en: "Correct answers promote a card; incorrect answers demote it.",
            de: "Korrekte Antworten befoerdern eine Karte, falsche stufen sie herunter.",
          },
        ],
      },
      {
        id: "sr-order",
        title: { en: "Default order", de: "Standardreihenfolge" },
        bullets: [
          {
            en: "In order, Random, or Repetition (box-weighted; lower boxes appear more often).",
            de: "In order, Random oder Repetition (box-gewichtet; niedrigere Boxen haeufiger).",
          },
        ],
      },
      {
        id: "sr-flow",
        title: { en: "Workflow", de: "Workflow" },
        bullets: [
          {
            en: "Select a user, load cards, review, and watch stats update live.",
            de: "User waehlen, Karten laden, wiederholen und Live-Statistiken beobachten.",
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    title: { en: "Settings explained", de: "Einstellungen erklaert" },
    summary: {
      en: "What the main options control and where defaults live.",
      de: "Welche Optionen was steuern und wo Standards gesetzt werden.",
    },
    sections: [
      {
        id: "settings-flashcards",
        title: { en: "Flashcard Tools defaults", de: "Flashcard-Tools-Defaults" },
        bullets: [
          {
            en: "Scan scope, order, page size, and stats reset define the review flow.",
            de: "Scan-Scope, Reihenfolge, Page Size und Statistik-Reset steuern den Ablauf.",
          },
        ],
      },
      {
        id: "settings-sr",
        title: {
          en: "Spaced Repetition Tools defaults",
          de: "Spaced Repetition-Tools-Defaults",
        },
        bullets: [
          {
            en: "Boxes, order, page size, and repetition strength set SR behavior.",
            de: "Boxen, Reihenfolge, Page Size und Repetition Strength bestimmen SR.",
          },
        ],
      },
      {
        id: "settings-language",
        title: { en: "Language & appearance", de: "Sprache & Aussehen" },
        bullets: [
          {
            en: "Language switches labels instantly; theme and accent change visuals.",
            de: "Sprache schaltet Labels sofort um; Theme und Accent aendern das Aussehen.",
          },
        ],
      },
      {
        id: "settings-persistence",
        title: { en: "Persistence", de: "Persistenz" },
        bullets: [
          {
            en: "All settings and tool options are saved automatically and restored after restart.",
            de: "Alle Einstellungen und Tool-Optionen werden automatisch gespeichert.",
          },
        ],
      },
    ],
  },
  {
    id: "advanced",
    title: { en: "More settings / Advanced", de: "Weitere Einstellungen / Advanced" },
    summary: {
      en: "Performance, layout tweaks, and power options.",
      de: "Performance, Layout-Anpassungen und Power-Optionen.",
    },
    sections: [
      {
        id: "advanced-performance",
        title: { en: "Performance", de: "Performance" },
        bullets: [
          {
            en: "Max files per scan and scan parallelism limit how much is indexed at once.",
            de: "Max Files pro Scan und Scan-Parallelism begrenzen die Indexierung.",
          },
        ],
      },
      {
        id: "advanced-layout",
        title: { en: "Layout", de: "Layout" },
        bullets: [
          {
            en: "The right toolbar can be collapsed and restored with the FMD toggle.",
            de: "Die rechte Toolbar laesst sich ueber den FMD-Schalter einklappen.",
          },
        ],
      },
      {
        id: "advanced-data",
        title: { en: "Data & Sync", de: "Data & Sync" },
        bullets: [
          {
            en: "Data & Sync collects storage-related options; some items may be placeholders.",
            de: "Data & Sync enthaelt Speicher-Optionen; einige Punkte koennen Platzhalter sein.",
          },
        ],
      },
    ],
  },
  {
    id: "vault",
    title: { en: "Load a vault", de: "Vault laden" },
    summary: {
      en: "Select a vault and troubleshoot common issues.",
      de: "Vault auswaehlen und typische Probleme beheben.",
    },
    sections: [
      {
        id: "vault-select",
        title: { en: "Select a vault", de: "Vault auswaehlen" },
        bullets: [
          {
            en: "Use Dashboard to choose a folder and allow access when prompted.",
            de: "Im Dashboard einen Ordner waehlen und Zugriff erlauben.",
          },
          {
            en: "After loading, pick a note to preview and scan.",
            de: "Nach dem Laden eine Notiz waehlen und scannen.",
          },
        ],
      },
      {
        id: "vault-issues",
        title: { en: "Common issues", de: "Haeufige Probleme" },
        bullets: [
          {
            en: "Missing permissions can block the file list or previews.",
            de: "Fehlende Berechtigungen blockieren Dateiliste oder Vorschau.",
          },
          {
            en: "If the list is empty, verify the path and markdown file types.",
            de: "Bei leerer Liste Pfad und Markdown-Dateien pruefen.",
          },
          {
            en: "If the vault moved, reselect it in Dashboard.",
            de: "Wenn der Vault verschoben wurde, neu auswaehlen.",
          },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: { en: "Additional features", de: "Weitere Funktionsbereiche" },
    summary: {
      en: "Focus mode, shortcuts, and optional tooling.",
      de: "Fokusmodus, Shortcuts und optionale Funktionen.",
    },
    sections: [
      {
        id: "extras-focus",
        title: { en: "Focus mode", de: "Fokusmodus" },
        bullets: [
          {
            en: "Use the eye icon to focus on the card and hide the rest of the UI.",
            de: "Mit dem Auge-Icon nur die Karte anzeigen und den Rest ausblenden.",
          },
          {
            en: "Press Esc to exit focus mode.",
            de: "Mit Esc den Fokusmodus verlassen.",
          },
        ],
      },
      {
        id: "extras-shortcuts",
        title: { en: "Shortcuts", de: "Shortcuts" },
        bullets: [
          {
            en: "In focus mode: Left/Right for Back/Next, Enter to submit when possible.",
            de: "Im Fokusmodus: Links/Rechts fuer Zurueck/Weiter, Enter zum Abgeben.",
          },
          {
            en: "Shortcuts are ignored while typing in inputs.",
            de: "Shortcuts werden in Eingabefeldern ignoriert.",
          },
        ],
      },
      {
        id: "extras-import",
        title: { en: "Import / Export", de: "Import / Export" },
        bullets: [
          {
            en: "If available, use Data & Sync to manage exports; otherwise it is coming later.",
            de: "Falls vorhanden, ueber Data & Sync exportieren; sonst Coming Later.",
          },
        ],
      },
    ],
  },
];

const resolveText = (value: LocalizedText, language: AppLanguage) => {
  if (language === "de") {
    return value.de ?? value.en ?? "";
  }
  return value.en ?? value.de ?? "";
};

const resolveList = (items: LocalizedText[] | undefined, language: AppLanguage) =>
  (items ?? [])
    .map((item) => resolveText(item, language))
    .filter((item) => item.trim() !== "");

export const HelpPage = () => {
  const { settings } = useAppState();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [copiedExampleId, setCopiedExampleId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const language = settings.language;
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId) ?? null;

  const titleText = resolveText(helpHeader.title, language);

  const copyLabel = resolveText(helpLabels.copy, language);
  const copiedLabel = resolveText(helpLabels.copied, language);

  const handleCopy = async (example: HelpExample) => {
    const text = example.code;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedExampleId(example.id);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedExampleId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy example", error);
    }
  };

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <>
      <header className="content-header">
        <div>
          <p className="eyebrow">{resolveText(helpHeader.eyebrow, language)}</p>
          <h1>{titleText}</h1>
          <p className="muted">{resolveText(helpHeader.summary, language)}</p>
        </div>
      </header>
      <section className="panel help-panel">
        <div className="panel-body help-body">
          {activeTopic ? (
            <>
              <div className="help-detail-header">
                <div className="help-breadcrumb">
                  <span>{titleText}</span>
                  <span className="help-crumb-sep">&gt;</span>
                  <span>{resolveText(activeTopic.title, language)}</span>
                  {activeTopic.draft ? (
                    <span className="chip">
                      {resolveText(helpLabels.draft, language)}
                    </span>
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
              <p className="muted">
                {resolveText(activeTopic.summary, language)}
              </p>
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
                            const isCopied = copiedExampleId === example.id;
                            return (
                              <div key={example.id} className="help-example">
                                <div className="help-example-header">
                                  <div className="help-example-text">
                                    <div className="help-example-title">
                                      {exampleTitle}
                                    </div>
                                    {exampleDescription ? (
                                      <p className="help-example-description">
                                        {exampleDescription}
                                      </p>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    className="ghost small help-copy"
                                    onClick={() => handleCopy(example)}
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
            </>
          ) : (
            <div className="help-overview-grid">
              {helpTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className="help-topic-card"
                  aria-label={`${resolveText(
                    helpLabels.openTopic,
                    language,
                  )}: ${resolveText(topic.title, language)}`}
                  onClick={() => setActiveTopicId(topic.id)}
                >
                  {topic.icon ? (
                    <span className="help-topic-icon">{topic.icon}</span>
                  ) : null}
                  <div className="help-topic-content">
                    <div className="help-topic-title">
                      {resolveText(topic.title, language)}
                    </div>
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
          )}
        </div>
      </section>
    </>
  );
};
