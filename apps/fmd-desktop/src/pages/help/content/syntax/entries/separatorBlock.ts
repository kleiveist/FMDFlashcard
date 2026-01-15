import { SyntaxEntry } from "../../types";
import { joinLines } from "./helpers";

export const separatorBlockEntry: SyntaxEntry = {
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
  };
