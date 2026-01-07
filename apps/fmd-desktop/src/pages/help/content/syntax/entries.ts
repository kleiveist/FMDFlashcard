/**
 * @file apps/fmd-desktop/src/pages/help/content/syntax/entries.ts
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

import { SyntaxEntry } from "../types";

const joinLines = (lines: string[]) => lines.join("\n");

export const flashcardSyntaxEntries: SyntaxEntry[] = [
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
