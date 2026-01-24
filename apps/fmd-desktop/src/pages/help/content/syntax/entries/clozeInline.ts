import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const clozeInlineEntry: SyntaxEntry = {
    id: "cloze-inline",
    title: { en: "Cloze + drag tokens", de: "Cloze + Drag-Tokens" },
    markers: ["%...%", '"token"'],
    keyRule: {
      en: "Typed cloze blanks and drag tokens can be combined.",
      de: "Cloze-Luecken und Drag-Tokens koennen kombiniert werden.",
    },
    snippet: {
      en: '%Paris% and "Seine"',
      de: '%Paris% und "Seine"',
    },
    detail: {
      en: {
        whatItIs:
          'Cloze blanks (%...%) are typed inputs, while drag tokens ("...") become drag blanks. You can use both in one card and combine with other syntaxes if desired.',
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %...% for typed cloze blanks.",
          'Use "..." for drag tokens.',
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard that may combine typed blanks and drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Typed blanks use %...%.",
          '- Drag tokens use "...".',
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          '{{prompt_with_%cloze%_and_"token"}}',
          "#",
        ]),
        example: joinLines([
          "#card",
          'Fill in: The capital of France is %Paris% and the river is "Seine".',
          "#",
        ]),
        mistakes: [
          "Leaving an empty %...% segment.",
          'Forgetting "..." around a drag token.',
        ],
      },
      de: {
        whatItIs:
          'Cloze-Luecken (%...%) sind Eingabefelder, Drag-Tokens ("...") werden zu Drag-Luecken. Beides kann in einer Karte stehen und mit anderen Syntaxen kombiniert werden.',
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%...% fuer Cloze-Eingaben nutzen.",
          '"..." fuer Drag-Tokens nutzen.',
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte, die Eingabeblanks und Drag-Tokens kombinieren darf.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Eingabeblanks mit %...%.",
          '- Drag-Tokens mit "...".',
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          '{{frage_mit_%cloze%_und_"token"}}',
          "#",
        ]),
        example: joinLines([
          "#card",
          'Fill in: Die Hauptstadt von Frankreich ist %Paris% und der Fluss ist "Seine".',
          "#",
        ]),
        mistakes: [
          "Leere %...%-Blaenke lassen.",
          '"..." fuer Drag-Tokens vergessen.',
        ],
      },
    },
  };
