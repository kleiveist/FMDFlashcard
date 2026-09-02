import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const mcMultiEntry: SyntaxEntry = {
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
        "Wrap the card with #card and #endcard on their own lines.",
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
        "#endcard",
      ]),
      example: joinLines([
        "#card",
        "Which numbers are prime?",
        "a) 2",
        "b) 4",
        "c) 5",
        "-a",
        "-c",
        "#endcard",
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
        "Karte mit #card und #endcard auf eigenen Zeilen umschliessen.",
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
        "#endcard",
      ]),
      example: joinLines([
        "#card",
        "Welche Zahlen sind prim?",
        "a) 2",
        "b) 4",
        "c) 5",
        "-a",
        "-c",
        "#endcard",
      ]),
      mistakes: [
        "Nur einen Marker setzen, obwohl mehrere Antworten richtig sind.",
        "Nicht alle korrekten Optionen markieren.",
      ],
    },
  },
};
