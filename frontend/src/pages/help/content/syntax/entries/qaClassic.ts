import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const qaClassicEntry: SyntaxEntry = {
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
          "Wrap the card with #card and #endcard on their own lines.",
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
          "#endcard",
        ]),
        example: joinLines([
          "#card",
          "What is SQL?",
          "Answer: A language for querying databases.",
          "#endcard",
        ]),
        mistakes: [
          "Placing Answer: before the prompt.",
          "Putting #card and #endcard on the same line.",
          "Mixing with multiple choice or true/false.",
        ],
      },
      de: {
        whatItIs:
          "Nutze eine direkte Frage in der ersten nicht-leeren Zeile und schreibe die Antwort nach dem Marker Antwort: (oder Answer:). Die Antwort darf in derselben Zeile oder in den folgenden Zeilen stehen. Answer: und Antwort: verhalten sich identisch; nur die Sprache des Labels aendert sich.",
        rules: [
          "Karte mit #card und #endcard auf eigenen Zeilen umschliessen.",
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
          "#endcard",
        ]),
        example: joinLines([
          "#card",
          "Was ist SQL?",
          "Antwort: Eine Sprache zum Abfragen von Datenbanken.",
          "#endcard",
        ]),
        mistakes: [
          "Antwort: vor die Frage setzen.",
          "#card und #endcard in derselben Zeile schreiben.",
          "Mit Multiple Choice oder True/False mischen.",
        ],
      },
    },
  };
