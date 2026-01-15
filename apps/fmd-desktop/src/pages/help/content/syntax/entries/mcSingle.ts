import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const mcSingleEntry: SyntaxEntry = {
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
  };
