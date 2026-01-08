/**
 * @file apps/fmd-desktop/src/lib/flashcards.test.ts
 *
 * Zweck:
 * - Testet flashcards.test und zugehoerige Logik.
 *
 * Verantwortlichkeiten:
 * - Prueft erwartetes Verhalten und Randfaelle.
 * - Sichert Regressionen fuer zentrale Szenarien.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/flashcards.ts: Hilfsfunktionen oder Typen.
 * - vitest: Externe Bibliothek.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  parseFlashcards,
  splitAnswerCard,
  type Flashcard,
} from "./flashcards";

const getCompositeParts = (card: Flashcard | undefined) => {
  expect(card?.kind).toBe("composite");
  if (!card || card.kind !== "composite") {
    throw new Error("Expected composite card");
  }
  return card.parts;
};

const getSinglePart = (card: Flashcard | undefined) => {
  const parts = getCompositeParts(card);
  expect(parts).toHaveLength(1);
  return parts[0];
};

describe("parseFlashcards", () => {
  it("parses a single card", () => {
    const markdown = `#card
1.5 Which SQL category controls access rights?
a) DML
b) DDL
c) TCL
d) DCL

-d
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.question).toBe("1.5 Which SQL category controls access rights?");
      expect(part.options).toEqual([
        { key: "a", text: "DML" },
        { key: "b", text: "DDL" },
        { key: "c", text: "TCL" },
        { key: "d", text: "DCL" },
      ]);
      expect(part.correctKeys).toEqual(["d"]);
    }
  });

  it("parses multiple cards in one document", () => {
    const markdown = `Intro text.

#card
First question?
a) One
b) Two
-b
#

Some notes between.

#card
Second question?
a) Alpha
b) Beta
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(2);
    const firstPart = getSinglePart(cards[0]);
    const secondPart = getSinglePart(cards[1]);
    expect(firstPart.kind).toBe("multiple-choice");
    expect(secondPart.kind).toBe("multiple-choice");
    if (firstPart.kind === "multiple-choice") {
      expect(firstPart.question).toBe("First question?");
    }
    if (secondPart.kind === "multiple-choice") {
      expect(secondPart.question).toBe("Second question?");
    }
  });

  it("parses multiple parts inside a single block", () => {
    const markdown = `#card
Statement 1. Wahr/Falsch?
-wahr

What is SQL?
Answer: A query language.

Pick one.
a) First
b) Second
-a
Pick two.
a) Alpha
b) Beta
c) Gamma
-a
-c

Cloze sample.
Use %%token%% with \`drag\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts.map((part) => part.kind)).toEqual([
      "true-false",
      "free-text",
      "multiple-choice",
      "multiple-choice",
      "cloze",
    ]);
    const [trueFalsePart, freeTextPart, singleMc, multiMc, clozePart] = parts;
    if (trueFalsePart.kind === "true-false") {
      expect(trueFalsePart.items).toHaveLength(1);
    }
    if (freeTextPart.kind === "free-text") {
      expect(freeTextPart.front).toBe("What is SQL?");
      expect(freeTextPart.back).toBe("A query language.");
    }
    if (singleMc.kind === "multiple-choice") {
      expect(singleMc.options).toEqual([
        { key: "a", text: "First" },
        { key: "b", text: "Second" },
      ]);
      expect(singleMc.correctKeys).toEqual(["a"]);
    }
    if (multiMc.kind === "multiple-choice") {
      expect(multiMc.options).toEqual([
        { key: "a", text: "Alpha" },
        { key: "b", text: "Beta" },
        { key: "c", text: "Gamma" },
      ]);
      expect(multiMc.correctKeys).toEqual(["a", "c"]);
    }
    if (clozePart.kind === "cloze") {
      expect(clozePart.dragTokens).toEqual([{ id: "token-0", value: "drag" }]);
    }
  });

  it("parses inline answer parts inside a composite card", () => {
    const markdown = `#card
Inline question? Answer: Inline answer.

Pick one.
a) First
b) Second
-a
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    const [freeText, multipleChoice] = parts;
    expect(freeText.kind).toBe("free-text");
    if (freeText.kind === "free-text") {
      expect(freeText.front).toBe("Inline question?");
      expect(freeText.back).toBe("Inline answer.");
    }
    expect(multipleChoice.kind).toBe("multiple-choice");
  });

  it("splits parts on separators inside a block", () => {
    const markdown = `#card
    First question?
    Answer: One
    ---
Second question?
Answer: Two
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    const [first, second] = parts;
    expect(first.kind).toBe("free-text");
    expect(second.kind).toBe("free-text");
    if (first.kind === "free-text") {
      expect(first.front).toBe("First question?");
      expect(first.back).toBe("One");
    }
    if (second.kind === "free-text") {
      expect(second.front).toBe("Second question?");
      expect(second.back).toBe("Two");
    }
  });

  it("keeps '# Title' lines inside a card and uses '#' as the only terminator", () => {
    const markdown = `#card
# Heading inside
Answer: heading text stays inside
#
`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
  });

  it("treats '#exam' markers inside a card as plain text", () => {
    const markdown = `#card
#exam should be kept
Answer: yep
#
`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toContain("#exam");
    }
  });

  it("parses a mixed composite block split by explicit separators", () => {
    const markdown = `#card
True/False? \`tf\`
-wahr
---
Pick two.
a) One
b) Two
c) Three
-a
-c
---
Cloze chain: %%first%% and \`token\`.
---
QA check.
Answer: Confirmed.
#
`;

    const cards = parseFlashcards(markdown);
    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts.map((part) => part.kind)).toEqual([
      "true-false",
      "multiple-choice",
      "cloze",
      "free-text",
    ]);
    const [tfPart, mcPart, clozePart] = parts;
    expect(parts).toHaveLength(4);
    if (tfPart.kind === "true-false") {
      expect(tfPart.items).toHaveLength(1);
    }
    if (mcPart.kind === "multiple-choice") {
      expect(mcPart.correctKeys).toEqual(["a", "c"]);
    }
    if (clozePart.kind === "cloze") {
      expect(clozePart.dragTokens).toEqual([{ id: "token-0", value: "token" }]);
    }
  });

  it("parses a front/back card with Answer marker", () => {
    const markdown = `#card
What is SQL used for as a common interface?
Answer: SQL is used to define, manipulate, manage permissions, and handle transactions.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("What is SQL used for as a common interface?");
      expect(part.back).toBe(
        "SQL is used to define, manipulate, manage permissions, and handle transactions.",
      );
    }
  });

  it("parses a front/back card with inline Answer marker", () => {
    const markdown = `#card
Define foreign key. Answer: An attribute that references a primary key.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("Define foreign key.");
      expect(part.back).toBe("An attribute that references a primary key.");
    }
  });

  it("parses a front/back card with lowercase answer marker", () => {
    const markdown = `#card
What is DNS?
answer: Domain name system.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("What is DNS?");
      expect(part.back).toBe("Domain name system.");
    }
  });

  it("parses a front/back card with Answer marker spacing", () => {
    const markdown = `#card
What is DNS?
Answer : Domain name system.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("What is DNS?");
      expect(part.back).toBe("Domain name system.");
    }
  });

  it("parses answer-only cards", () => {
    const markdown = `#card
Answer: True.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("");
      expect(part.back).toBe("True.");
    }
  });

  it("parses a front/back card with bold Answer marker", () => {
    const markdown = `#card
What is RAM?
**Answer:** Random access memory.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("What is RAM?");
      expect(part.back).toBe("Random access memory.");
    }
  });

  it("parses a front/back card with bold Answer marker and trailing colon", () => {
    const markdown = `#card
What is CPU?
**Answer**: Central processing unit.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("What is CPU?");
      expect(part.back).toBe("Central processing unit.");
    }
  });

  it("parses a front/back card with Antwort marker", () => {
    const markdown = `#card
1. Was ist eine Transaktion?
Antwort:
Eine Transaktion ist eine atomare Einheit von Operationen.
#
`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("1. Was ist eine Transaktion?");
      expect(part.back).toBe(
        "Eine Transaktion ist eine atomare Einheit von Operationen.",
      );
    }
  });

  it("splits Answer markers in inline and block forms", () => {
    const inlineSplit = splitAnswerCard([
      "8) Define a foreign key. Answer: A foreign key is an attribute.",
    ]);
    expect(inlineSplit).toEqual({
      front: "8) Define a foreign key.",
      back: "A foreign key is an attribute.",
    });

    const blockSplit = splitAnswerCard(["What is RAM?", "Answer : Memory."]);
    expect(blockSplit).toEqual({
      front: "What is RAM?",
      back: "Memory.",
    });
  });

  it("parses a front/back card with Reponse marker", () => {
    const markdown = `#card
Que signifie SQL ?
Reponse: SQL est un langage pour interroger des bases de donnees.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("Que signifie SQL ?");
      expect(part.back).toBe(
        "SQL est un langage pour interroger des bases de donnees.",
      );
    }
  });

  it("parses a single true/false item", () => {
    const markdown = `#card
1. The earth orbits the sun. Wahr/Falsch?
-wahr
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items).toEqual([
        {
          id: "tf-0",
          question: "1. The earth orbits the sun. Wahr/Falsch?",
          correct: "wahr",
        },
      ]);
    }
  });

  it("parses true/false items without suffix in other languages", () => {
    const markdown = `#card
La tierra orbita el sol.
-verdadero
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items).toEqual([
        {
          id: "tf-0",
          question: "La tierra orbita el sol.",
          correct: "wahr",
        },
      ]);
    }
  });

  it("parses multiple true/false items in one block", () => {
    const markdown = `#card
2. Water boils at 100C. Wahr/Falsch?
-wahr
3. The moon is a planet. Wahr/Falsch?
-falsch
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    const [first, second] = parts;
    expect(first.kind).toBe("true-false");
    expect(second.kind).toBe("true-false");
    if (first.kind === "true-false") {
      expect(first.items).toEqual([
        {
          id: "tf-0",
          question: "2. Water boils at 100C. Wahr/Falsch?",
          correct: "wahr",
        },
      ]);
    }
    if (second.kind === "true-false") {
      expect(second.items).toEqual([
        {
          id: "tf-0",
          question: "3. The moon is a planet. Wahr/Falsch?",
          correct: "falsch",
        },
      ]);
    }
  });

  it("skips true/false questions without valid markers", () => {
    const markdown = `#card
Missing marker. Wahr/Falsch?
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses true/false markers case-insensitively", () => {
    const markdown = `#card
Case check. Wahr/Falsch?
-FALSCH
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items[0]?.correct).toBe("falsch");
    }
  });

  it("parses true/false markers with spacing and punctuation", () => {
    const markdown = `#card
Spacing check.
- falsch,
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items[0]?.correct).toBe("falsch");
    }
  });

  it("collects multiple correct markers", () => {
    const markdown = `#card
Choose two.
a) One
b) Two
c) Three

-a
-d
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.correctKeys).toEqual(["a", "d"]);
    }
  });

  it("parses correct markers after blank lines", () => {
    const markdown = `#card
Pick one.
a) Alpha
b) Beta
c) Gamma

-c
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.correctKeys).toEqual(["c"]);
    }
  });

  it("ignores irrelevant text outside cards", () => {
    const markdown = `Random text.
- Not a marker.
#card
Question?
a) Option
#
More text.`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.question).toBe("Question?");
    }
  });

  it("parses multiple cloze cards with separators", () => {
    const markdown = `Intro section.
---
#card
First.
Fill %%one%% and \`alpha\`.
#
---
#card
Second.
Only \`beta\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(2);
    const firstPart = getSinglePart(cards[0]);
    const secondPart = getSinglePart(cards[1]);
    expect(firstPart.kind).toBe("cloze");
    expect(secondPart.kind).toBe("cloze");
    if (firstPart.kind === "cloze") {
      expect(firstPart.dragTokens).toEqual([{ id: "token-0", value: "alpha" }]);
      expect(firstPart.segments).toEqual([
        { type: "text", value: "Fill " },
        { type: "blank", id: "blank-0", kind: "input", solution: "one" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "alpha" },
        { type: "text", value: "." },
      ]);
    }
    if (secondPart.kind === "cloze") {
      expect(secondPart.dragTokens).toEqual([{ id: "token-0", value: "beta" }]);
      expect(secondPart.segments).toEqual([
        { type: "text", value: "Only " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "beta" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("skips cards with missing end markers", () => {
    const markdown = `#card
Question without end?
a) Option`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses cloze cards with %% blanks", () => {
    const markdown = `#card
Define foreign key.
A foreign key is an %% attribute or attribute set %% that references a %%primary key%% in another %% table %%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.question).toBe("Define foreign key.");
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "A foreign key is an " },
        {
          type: "blank",
          id: "blank-0",
          kind: "input",
          solution: "attribute or attribute set",
        },
        { type: "text", value: " that references a " },
        { type: "blank", id: "blank-1", kind: "input", solution: "primary key" },
        { type: "text", value: " in another " },
        { type: "blank", id: "blank-2", kind: "input", solution: "table" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("supports multiple blanks with and without spacing", () => {
    const markdown = `#card
Short cloze.
%%alpha%% and %% beta %% then %%gamma%%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.segments).toEqual([
        { type: "blank", id: "blank-0", kind: "input", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "input", solution: "beta" },
        { type: "text", value: " then " },
        { type: "blank", id: "blank-2", kind: "input", solution: "gamma" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("collects backtick tokens alongside blanks", () => {
    const markdown = `#card
Mixed markers.
Use %%blank%% with \`alpha\` and \`beta\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "input", solution: "blank" },
        { type: "text", value: " with " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-2", kind: "drag", solution: "beta" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("keeps cards with only backtick tokens", () => {
    const markdown = `#card
Only tokens.
Use \`alpha\` and \`beta\` here.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "beta" },
        { type: "text", value: " here." },
      ]);
    }
  });

  it("keeps duplicate tokens with unique ids", () => {
    const markdown = `#card
Duplicate tokens.
Use \`same\` and \`same\` again.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "same" },
        { id: "token-1", value: "same" },
      ]);
    }
  });

  it("handles unclosed %% safely", () => {
    const markdown = `#card
Broken markers.
Valid %%answer%% and %%unfinished.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and %%unfinished." },
      ]);
    }
  });

  it("handles unclosed backticks safely", () => {
    const markdown = `#card
Broken token.
Valid %%answer%% and \`unfinished.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and `unfinished." },
      ]);
    }
  });

  it("ignores markers inside fenced code blocks", () => {
    const markdown = `#card
Question.
Code:
~~~
\`ignored\`
%%not%%
~~~
Outside \`token\` and %%blank%%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([{ id: "token-0", value: "token" }]);
      const blanks = part.segments.filter((segment) => segment.type === "blank");
      expect(blanks).toEqual([
        { type: "blank", id: "blank-0", kind: "drag", solution: "token" },
        { type: "blank", id: "blank-1", kind: "input", solution: "blank" },
      ]);
    }
  });

  it("skips cards with empty blanks", () => {
    const markdown = `#card
Empty blank.
%%%%
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("matches input blanks case-insensitively with trim", () => {
    expect(isInputAnswerMatch(" Atomic Values ", "atomic values")).toBe(true);
    expect(isInputAnswerMatch("Atomic", "atom")).toBe(false);
  });

  it("matches drag tokens by trimmed exact value", () => {
    expect(isDragAnswerMatch("Token", "Token")).toBe(true);
    expect(isDragAnswerMatch("Token ", "Token")).toBe(true);
    expect(isDragAnswerMatch("token", "Token")).toBe(false);
  });
});
