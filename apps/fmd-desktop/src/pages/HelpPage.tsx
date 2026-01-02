const helpSections = [
  {
    id: "workflow",
    title: "Workflow overview",
    bullets: [
      "Pick a vault in Dashboard -> select a note -> scan -> review (Flashcards / Spaced Repetition) -> stats and progress.",
    ],
  },
  {
    id: "persistence",
    title: "Persistence (Important)",
    bullets: [
      "All settings and tool options are saved automatically and restored after restart.",
    ],
  },
  {
    id: "preview-edit",
    title: "Preview & Edit",
    bullets: [
      "Edit opens the editor, Save persists changes, Cancel discards edits and returns to preview.",
    ],
  },
  {
    id: "flashcards",
    title: "Flashcards scans",
    bullets: [
      "Current note scans only the selected note; Whole vault scans all markdown files.",
      "Default order controls in-order vs random scanning.",
      "Page size controls how many cards are shown at once.",
      "Statistics reset defines when counts reset (per scan or per session).",
    ],
  },
  {
    id: "settings",
    title: "Settings reference",
    bullets: [
      "Default behavior (scan scope, order, boxes, page size, stats reset) can be adjusted in Settings.",
    ],
  },
  {
    id: "spaced-repetition",
    title: "Spaced Repetition (Leitner)",
    bullets: [
      "3/5/8 boxes represent learning stages.",
      "Correct answers promote a card; incorrect answers demote it.",
      "Cards in the last box are excluded from sessions (3->3, 5->5, 8->8).",
      "Default order: In order, Random, or Repetition (box-weighted, lower boxes appear more often).",
    ],
  },
  {
    id: "syntax",
    title: "Syntax / Content Rules",
    draft: true,
    bullets: [
      "Cards start with #card and end with #. Invalid cards are skipped.",
      "Multiple choice uses options like a) Answer and a marker like -a for the correct key.",
      "Cloze uses %%answer%% for input blanks and `token` for drag blanks.",
      "True/False uses the suffix 'Wahr/Falsch?' and a marker -wahr or -falsch.",
    ],
    examples: [
      "#card\nQuestion line\na) Option A\nb) Option B\n-a\n#",
      "#card\nFill in: The capital of France is %%Paris%% and `Seine` flows nearby.\n#",
      "#card\nStatement Wahr/Falsch?\n-wahr\n#",
    ],
  },
];

export const HelpPage = () => (
  <>
    <header className="content-header">
      <div>
        <p className="eyebrow">Help</p>
        <h1>Help</h1>
        <p className="muted">Quick reminders for the workflow and syntax.</p>
      </div>
    </header>
    <section className="panel help-panel">
      <div className="panel-body help-body">
        {helpSections.map((section) => (
          <div key={section.id} className="help-item">
            <div className="help-item-header">
              <span className="label">{section.title}</span>
              {section.draft ? <span className="chip">Draft</span> : null}
            </div>
            <ul className="help-list">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {section.examples ? (
              <div className="help-examples">
                {section.examples.map((example) => (
                  <pre key={example} className="help-code">
                    {example}
                  </pre>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  </>
);
