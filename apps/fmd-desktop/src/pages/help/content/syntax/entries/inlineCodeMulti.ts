import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const inlineCodeMultiEntry: SyntaxEntry = {
    id: "inline-code-multi",
    title: { en: "Drag tokens", de: "Drag-Tokens" },
    markers: ['tocken "token"'],
    keyRule: {
      en: 'Multiple tocken "..." tokens in one line create multiple drag blanks.',
      de: 'Mehrere tocken "..."-Tokens in einer Zeile erzeugen mehrere Drag-Luecken.',
    },
    snippet: {
      en: 'tocken "git" tocken "status"',
      de: 'tocken "git" tocken "status"',
    },
    detail: {
      en: {
        whatItIs:
          'Drag tokens (tocken "...") become draggable blanks. You can place multiple tokens in one line to create multiple blanks.',
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          'Use tocken "..." around each drag token.',
          "Multiple tokens per line are allowed.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one flashcard with multiple drag tokens.",
          "Return only the #card block.",
          "Rules:",
          '- Use tocken "..." around each token.',
          "- You may include multiple tokens per line.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          '{{text_with_tocken_"token_1"_and_tocken_"token_2"}}',
          "#",
        ]),
        example: joinLines([
          "#card",
          "Complete the command:",
          'tocken "git" tocken "status" shows changes.',
          "#",
        ]),
        mistakes: [
          'Using backticks instead of tocken "..."',
          "Leaving a token without a closing quote.",
        ],
      },
      de: {
        whatItIs:
          'Drag-Tokens (tocken "...") werden zu Drag-Luecken. Du kannst mehrere Tokens in einer Zeile setzen, um mehrere Luecken zu erzeugen.',
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          'Tokens mit tocken "..." markieren.',
          "Mehrere Tokens pro Zeile sind erlaubt.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Karte mit mehreren Drag-Tokens.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          '- Tokens mit tocken "..." markieren.',
          "- Mehrere Tokens pro Zeile sind erlaubt.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          '{{text_mit_tocken_"token_1"_und_tocken_"token_2"}}',
          "#",
        ]),
        example: joinLines([
          "#card",
          "Vervollstaendige den Befehl:",
          'tocken "git" tocken "status" zeigt Aenderungen.',
          "#",
        ]),
        mistakes: [
          'Backticks statt tocken "..." nutzen.',
          "Token ohne schliessende Anfuehrungszeichen.",
        ],
      },
    },
  };
