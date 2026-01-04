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

type SyntaxDetail = {
  whatItIs: string;
  rules: string[];
  rulesNote?: string;
  promptTemplate: string;
  example: string;
  mistakes?: string[];
};

type SyntaxEntry = {
  id: string;
  title: LocalizedText;
  markers: string[];
  keyRule: LocalizedText;
  snippet?: LocalizedText;
  detail: { en: SyntaxDetail; de: SyntaxDetail };
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

const joinLines = (lines: string[]) => lines.join("\n");

const flashcardSyntaxOverview = {
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
  ],
};

const flashcardSyntaxEntries: SyntaxEntry[] = [
  {
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
          "Cards must be wrapped with #card and #. The first non-empty line is the question. The remaining lines define the card type (options, blanks, or Answer/Antwort marker). Workflow: Dashboard -> select note -> scan -> review (via Flashcard Tools or Spaced Repetition Tools).",
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
          "Karten muessen mit #card und # umschlossen sein. Die erste nicht-leere Zeile ist die Frage. Die restlichen Zeilen definieren den Kartentyp (Optionen, Luecken oder Answer-/Antwort-Marker). Workflow: Dashboard -> Notiz waehlen -> scannen -> wiederholen (ueber Flashcard Tools oder Spaced Repetition Tools).",
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: "cloze-typed",
    title: { en: "Cloze (typed blanks)", de: "Cloze (Eingabe-Luecken)" },
    markers: ["%%...%%"],
    keyRule: {
      en: "%%...%% creates typed input blanks.",
      de: "%%...%% erzeugt Eingabe-Luecken.",
    },
    snippet: {
      en: "%%Paris%%",
      de: "%%Paris%%",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze cards hide parts of a sentence inside %%...%% and require typed input for each blank.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %%...%% to mark each typed blank.",
          "Each blank must have content inside the %%...%% markers.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard with typed blanks.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Use %%...%% for each blank.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%%cloze%%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %%Paris%%.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %%...%% segment.",
          "Forgetting to close a %%...%% marker.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Karten verstecken Teile eines Satzes in %%...%% und erwarten eine getippte Eingabe fuer jede Luecke.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%%...%% fuer jede Eingabe-Luecke nutzen.",
          "Jede Luecke muss Inhalt zwischen %%...%% haben.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte mit Eingabe-Luecken.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- %%...%% fuer jede Luecke nutzen.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%%cloze%%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Ergaenze: Die Hauptstadt von Frankreich ist %%Paris%%.",
          "#",
        ]),
        mistakes: [
          "Leere %%...%%-Luecken lassen.",
          "%%...%%-Marker nicht schliessen.",
        ],
      },
    },
  },
  {
    id: "cloze-inline",
    title: { en: "Cloze + inline code", de: "Cloze + Inline-Code" },
    markers: ["%%...%%", "`token`"],
    keyRule: {
      en: "Typed cloze blanks and inline-code drag tokens can be combined.",
      de: "Cloze-Luecken und Inline-Code-Drag-Tokens koennen kombiniert werden.",
    },
    snippet: {
      en: "%%Paris%% and `Seine`",
      de: "%%Paris%% und `Seine`",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze blanks (%%...%%) are typed inputs, while inline code tokens (`...`) become drag blanks. You can use both in one card and combine with other syntaxes if desired.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %%...%% for typed cloze blanks.",
          "Use `...` for drag tokens.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard that may combine typed blanks and drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Typed blanks use %%...%%.",
          "- Drag tokens use `...`.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%%cloze%%_and_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %%Paris%% and the river is `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %%...%% segment.",
          "Forgetting backticks around a drag token.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Luecken (%%...%%) sind Eingabefelder, Inline-Code-Tokens (`...`) werden zu Drag-Luecken. Beides kann in einer Karte stehen und mit anderen Syntaxen kombiniert werden.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%%...%% fuer Cloze-Eingaben nutzen.",
          "`...` fuer Drag-Tokens nutzen.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte, die Eingabeblanks und Drag-Tokens kombinieren darf.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Eingabeblanks mit %%...%%.",
          "- Drag-Tokens mit `...`.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%%cloze%%_und_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: Die Hauptstadt von Frankreich ist %%Paris%% und der Fluss ist `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leere %%...%%-Blaenke lassen.",
          "Backticks fuer Drag-Tokens vergessen.",
        ],
      },
    },
  },
];

const helpTopics: HelpTopic[] = [
  {
    id: "flashcard-syntax",
    title: { en: "Flashcard syntax", de: "Karteikarten-Syntax" },
    summary: {
      en: "Complete syntax reference with examples for every supported card type.",
      de: "Komplette Syntax-Referenz mit Beispielen fuer alle Kartentypen.",
    },
    sections: [],
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
  const [activeSyntaxId, setActiveSyntaxId] = useState<string | null>(
    flashcardSyntaxEntries[0]?.id ?? null,
  );
  const [syntaxLanguage, setSyntaxLanguage] = useState<AppLanguage>(
    settings.language,
  );
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const language = settings.language;
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId) ?? null;
  const isSyntaxTopic = activeTopic?.id === "flashcard-syntax";
  const activeSyntax =
    flashcardSyntaxEntries.find((entry) => entry.id === activeSyntaxId) ??
    flashcardSyntaxEntries[0] ??
    null;

  const titleText = resolveText(helpHeader.title, language);

  const copyLabel = resolveText(helpLabels.copy, language);
  const copiedLabel = resolveText(helpLabels.copied, language);
  const syntaxCopyExampleLabel = resolveText(
    helpLabels.copyExample,
    syntaxLanguage,
  );
  const syntaxCopyPromptLabel = resolveText(
    helpLabels.copyPrompt,
    syntaxLanguage,
  );
  const syntaxCopiedLabel = resolveText(helpLabels.copied, syntaxLanguage);
  const syntaxPromptLabel = resolveText(
    helpLabels.promptTemplate,
    syntaxLanguage,
  );
  const syntaxExampleLabel = resolveText(helpLabels.example, syntaxLanguage);
  const syntaxRulesLabel = resolveText(helpLabels.rules, syntaxLanguage);
  const syntaxWhatItIsLabel = resolveText(helpLabels.whatItIs, syntaxLanguage);
  const syntaxMistakesLabel = resolveText(helpLabels.mistakes, syntaxLanguage);
  const syntaxMarkersLabel = resolveText(helpLabels.markers, syntaxLanguage);
  const overviewBullets = resolveList(
    flashcardSyntaxOverview.bullets,
    syntaxLanguage,
  );

  const handleCopy = async (text: string, copyId: string) => {
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
      setCopiedItemId(copyId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedItemId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy example", error);
    }
  };

  useEffect(() => {
    if (activeTopicId !== "flashcard-syntax") {
      return;
    }
    setActiveSyntaxId((prev) => {
      if (prev && flashcardSyntaxEntries.some((entry) => entry.id === prev)) {
        return prev;
      }
      return flashcardSyntaxEntries[0]?.id ?? null;
    });
    setSyntaxLanguage(settings.language);
  }, [activeTopicId, settings.language]);

  useEffect(() => {
    if (!activeTopicId) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setActiveTopicId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTopicId]);

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
              {isSyntaxTopic ? (
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
                        const entryTitle = resolveText(
                          entry.title,
                          syntaxLanguage,
                        );
                        const entrySnippet = entry.snippet
                          ? resolveText(entry.snippet, syntaxLanguage)
                          : "";
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={`help-syntax-card${
                              isActive ? " active" : ""
                            }`}
                            onClick={() => setActiveSyntaxId(entry.id)}
                            role="tab"
                            aria-selected={isActive}
                          >
                            <div className="help-syntax-card-title">
                              {entryTitle}
                            </div>
                            <div className="help-syntax-card-meta">
                              <span className="help-syntax-card-label">
                                {syntaxMarkersLabel}
                              </span>
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
                              <pre className="help-syntax-snippet">
                                {entrySnippet}
                              </pre>
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
                            {activeSyntax.detail[syntaxLanguage].rules.map(
                              (rule) => (
                                <li key={rule}>{rule}</li>
                              ),
                            )}
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
                                  activeSyntax.detail[syntaxLanguage]
                                    .promptTemplate,
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
                              <span className="label">
                                {syntaxMistakesLabel}
                              </span>
                            </div>
                            <ul className="help-syntax-list">
                              {activeSyntax.detail[syntaxLanguage].mistakes?.map(
                                (mistake) => (
                                  <li key={mistake}>{mistake}</li>
                                ),
                              )}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="help-detail-sections">
                  {activeTopic.sections.map((section) => {
                    const bullets = resolveList(section.bullets, language);
                    const examples = section.examples ?? [];
                    const sectionLabelClass =
                      section.tone === "help-block"
                        ? "help-block-title"
                        : "label";
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
                              const exampleTitle = resolveText(
                                example.title,
                                language,
                              );
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
                                      onClick={() =>
                                        handleCopy(example.code, copyId)
                                      }
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
              )}
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
