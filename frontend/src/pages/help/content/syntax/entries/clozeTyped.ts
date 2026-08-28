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
          "Wrap the card with #card and #endcard on their own lines.",
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
          "#endcard",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %Paris%.",
          "#endcard",
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
          "Karte mit #card und #endcard auf eigenen Zeilen umschliessen.",
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
          "#endcard",
        ]),
        example: joinLines([
          "#card",
          "Ergaenze: Die Hauptstadt von Frankreich ist %Paris%.",
          "#endcard",
        ]),
        mistakes: [
          "Leere %...%-Luecken lassen.",
          "%...%-Marker nicht schliessen.",
        ],
      },
    },
  };
