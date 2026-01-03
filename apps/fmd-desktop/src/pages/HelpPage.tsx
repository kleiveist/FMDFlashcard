import { useState } from "react";
import { useAppState } from "../components/AppStateProvider";

type AppLanguage = "de" | "en";
type LocalizedText = { de?: string; en?: string };

type HelpSection = {
  id: string;
  title: LocalizedText;
  bullets?: LocalizedText[];
  examples?: LocalizedText[];
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
  draft: { en: "Draft", de: "Entwurf" },
  openTopic: { en: "Open topic", de: "Thema oeffnen" },
};

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
            en: "Dashboard -> select a note -> scan -> review (Flashcards or Spaced Repetition).",
            de: "Dashboard -> Notiz waehlen -> scannen -> wiederholen (Flashcards oder Spaced Repetition).",
          },
        ],
      },
    ],
  },
  {
    id: "flashcard-syntax",
    title: { en: "Flashcard syntax", de: "Karteikarten-Syntax" },
    summary: {
      en: "Front/back blocks, free text answers, and classic formats.",
      de: "Vorder-/Rueckseite, Freitext und klassische Formate.",
    },
    draft: true,
    sections: [
      {
        id: "syntax-front-back",
        title: { en: "Front / Back", de: "Vorderseite / Rueckseite" },
        bullets: [
          {
            en: "Use an Answer:/Antwort: marker to split the card.",
            de: "Mit Answer:/Antwort: die Karte in Vorder- und Rueckseite teilen.",
          },
          {
            en: "Everything before the marker is the front; everything after is the back.",
            de: "Alles vor dem Marker ist die Vorderseite, alles danach die Rueckseite.",
          },
        ],
      },
      {
        id: "syntax-free-text",
        title: { en: "Free-text answers", de: "Freitext-Antworten" },
        bullets: [
          {
            en: "When an Answer/Antwort marker exists, a text input appears.",
            de: "Wenn ein Answer/Antwort-Marker existiert, erscheint ein Texteingabefeld.",
          },
          {
            en: "Check reveals the model answer, then self-grade Correct/Incorrect.",
            de: "Check zeigt die Musterloesung, danach selbst mit Korrekt/Inkorrekt bewerten.",
          },
        ],
      },
      {
        id: "syntax-true-false",
        title: { en: "True / False", de: "Wahr / Falsch" },
        bullets: [
          {
            en: "Use -<token> for the solution; tokens accept multiple languages (true/false, wahr/falsch, etc.).",
            de: "Die Loesung wird mit -<token> angegeben; Tokens sind mehrsprachig (true/false, wahr/falsch, usw.).",
          },
        ],
      },
      {
        id: "syntax-mc-cloze",
        title: { en: "Multiple choice & Cloze", de: "Multiple Choice & Cloze" },
        bullets: [
          {
            en: "Multiple choice uses a) Option and a marker like -a for the correct key.",
            de: "Multiple Choice nutzt a) Option und einen Marker wie -a fuer die richtige Antwort.",
          },
          {
            en: "Cloze uses %%answer%% for input blanks and `token` for drag blanks.",
            de: "Cloze nutzt %%answer%% fuer Eingabefelder und `token` fuer Drag-Optionen.",
          },
        ],
      },
      {
        id: "syntax-examples",
        title: { en: "Examples", de: "Beispiele" },
        examples: [
          {
            en: "#card\nWhat is SQL?\nAnswer: A language for querying databases.\n#",
            de: "#card\nWas ist SQL?\nAntwort: Eine Sprache zum Abfragen von Datenbanken.\n#",
          },
          {
            en: "#card\nQuestion line\na) Option A\nb) Option B\n-a\n#",
            de: "#card\nFrage\na) Option A\nb) Option B\n-a\n#",
          },
          {
            en: "#card\nFill in: The capital of France is %%Paris%% and `Seine` flows nearby.\n#",
            de: "#card\nErgaenze: Die Hauptstadt von Frankreich ist %%Paris%% und `Seine` fliesst dort.\n#",
          },
          {
            en: "#card\nStatement\n-true\n#",
            de: "#card\nAussage\n-wahr\n#",
          },
        ],
      },
    ],
  },
  {
    id: "spaced-repetition",
    title: { en: "Spaced repetition", de: "Spaced Repetition" },
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
        title: { en: "Flashcards defaults", de: "Flashcards-Defaults" },
        bullets: [
          {
            en: "Scan scope, order, page size, and stats reset define the review flow.",
            de: "Scan-Scope, Reihenfolge, Page Size und Statistik-Reset steuern den Ablauf.",
          },
        ],
      },
      {
        id: "settings-sr",
        title: { en: "Spaced Repetition defaults", de: "Spaced Repetition-Defaults" },
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
  const language = settings.language;
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId) ?? null;

  const titleText = resolveText(helpHeader.title, language);

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
                  const examples = resolveList(section.examples, language);
                  return (
                    <div key={section.id} className="help-detail-section">
                      <div className="help-item-header">
                        <span className="label">
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
                          {examples.map((example) => (
                            <pre key={example} className="help-code">
                              {example}
                            </pre>
                          ))}
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
