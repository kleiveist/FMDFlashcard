import { SyntaxEntry } from "../../types";
import { joinLines } from "../../syntax/entries/helpers";

export const cardBlockEntry: SyntaxEntry = {
  id: "card-block",
  title: { en: "Structured card block", de: "Strukturierter Kartenblock" },
  markers: ["#card", "#", "---"],
  keyRule: {
    en: "Use --- inside #card to split parts; close the card with #.",
    de: "--- trennt Teile innerhalb #card; Karte immer mit # schliessen.",
  },
  snippet: {
    en: "#card\n{{part_1}}\n---\n{{part_2}}\n#",
    de: "#card\n{{teil_1}}\n---\n{{teil_2}}\n#",
  },
  detail: {
    en: {
      whatItIs:
        "A structured card block uses '---' to split a card or task into parts. Inside a #card block, each '---' line separates sub-blocks; inside an #exam, '---' can separate tasks or parts depending on context.",
      rules: [
        "Use '---' on its own line to split parts inside #card.",
        "Always open the card with #card and close it with #.",
        "Inside #exam, numbered tasks still control the scope; '---' can separate parts within a task.",
        "Do not expect '---' to start or end a card by itself.",
        "Keep each part focused on one interaction type.",
      ],
      promptTemplate: joinLines([
        "Create one #card with two structured parts.",
        "Separate parts using a single '---' line.",
        "Rules:",
        "- #card and # must be on their own lines.",
        "- '---' must be on its own line.",
        "- Keep each part focused on one interaction type.",
        "Template:",
        "#card",
        "{{part_1_question}}",
        "{{part_1_answer}}",
        "---",
        "{{part_2_question}}",
        "{{part_2_answer}}",
        "#",
      ]),
      example: joinLines([
        "#card",
        "OSI model (part 1): Name the top three layers.",
        "Answer: Application, Presentation, Session.",
        "---",
        "OSI model (part 2): Name the bottom four layers.",
        "Answer: Transport, Network, Data Link, Physical.",
        "#",
      ]),
      mistakes: [
        "Using '---' inside a heading line (it must be on its own line).",
        "Forgetting to close #card with #.",
        "Expecting '---' to close an #exam block.",
        "Mixing too many interaction types in one part.",
      ],
    },
    de: {
      whatItIs:
        "Ein strukturierter Kartenblock nutzt '---', um eine Karte oder Aufgabe in Teile zu splitten. Innerhalb von #card trennt jede '---'-Zeile Sub-Bloecke; innerhalb von #exam kann '---' Aufgaben oder Teile trennen (je nach Kontext).",
      rules: [
        "'---' als eigene Zeile verwenden, um Teile in #card zu trennen.",
        "Die Karte immer mit #card oeffnen und mit # schliessen.",
        "Innerhalb von #exam steuern nummerierte Aufgaben den Scope; '---' trennt Teile innerhalb einer Aufgabe.",
        "'---' startet oder beendet keine Karte von selbst.",
        "Jeden Teil auf einen Interaktionstyp fokussieren.",
      ],
      promptTemplate: joinLines([
        "Erstelle eine #card mit zwei strukturierten Teilen.",
        "Trenne die Teile mit einer einzelnen '---'-Zeile.",
        "Regeln:",
        "- #card und # muessen auf eigenen Zeilen stehen.",
        "- '---' muss auf eigener Zeile stehen.",
        "- Jeder Teil soll nur einen Interaktionstyp haben.",
        "Template:",
        "#card",
        "{{teil_1_frage}}",
        "{{teil_1_antwort}}",
        "---",
        "{{teil_2_frage}}",
        "{{teil_2_antwort}}",
        "#",
      ]),
      example: joinLines([
        "#card",
        "OSI-Modell (Teil 1): Nenne die oberen drei Layer.",
        "Antwort: Anwendung, Darstellung, Sitzung.",
        "---",
        "OSI-Modell (Teil 2): Nenne die unteren vier Layer.",
        "Antwort: Transport, Netzwerk, Sicherung, Physisch.",
        "#",
      ]),
      mistakes: [
        "'---' in einer Heading-Zeile verwenden (muss eigene Zeile sein).",
        "# am Ende des #card-Blocks vergessen.",
        "Erwarten, dass '---' ein #exam beendet.",
        "Zu viele Interaktionstypen in einem Teil mischen.",
      ],
    },
  },
};
