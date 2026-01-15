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
