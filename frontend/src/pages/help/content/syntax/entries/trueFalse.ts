import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const trueFalseEntry: SyntaxEntry = {
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
          "Wrap the card with #card and #endcard on their own lines.",
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
          "#endcard",
        ]),
        example: joinLines([
          "#card",
          "The Earth orbits the Sun.",
          "-true",
          "Pluto is a planet.",
          "-false",
          "#endcard",
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
          "Karte mit #card und #endcard auf eigenen Zeilen umschliessen.",
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
          "#endcard",
        ]),
        example: joinLines([
          "#card",
          "Die Erde kreist um die Sonne.",
          "-true",
          "Pluto ist ein Planet.",
          "-false",
          "#endcard",
        ]),
        mistakes: [
          "Zwei Aussagen schreiben, aber nur einen Marker setzen.",
          "Marker ohne Aussagezeile setzen.",
        ],
      },
    },
  };
