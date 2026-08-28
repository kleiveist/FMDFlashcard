/**
 * @file frontend/src/lib/flashcards.test.ts
 *
 * Zweck:
 * - Testet flashcards.test und zugehoerige Logik.
 *
 * Verantwortlichkeiten:
 * - Prueft erwartetes Verhalten und Randfaelle.
 * - Sichert Regressionen fuer zentrale Szenarien.
 *
 * Verbunden mit:
 * - frontend/src/lib/flashcards.ts: Hilfsfunktionen oder Typen.
 * - vitest: Externe Bibliothek.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  parseFlashcardEntries,
  parseFlashcards,
  splitAnswerCard,
  type ClozeSegment,
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
#endcard`;

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

  it("keeps option-first cards from using a) as the question", () => {
    const markdown = `#card
a) Option A
b) Option B
-a
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.question).toBe("");
      expect(part.options).toEqual([
        { key: "a", text: "Option A" },
        { key: "b", text: "Option B" },
      ]);
      expect(part.correctKeys).toEqual(["a"]);
    }
  });

  it("parses cards with case-insensitive #card markers", () => {
    const markdown = `#CaRd
What is 2+2?
Answer: 4
#EnDcArD`;
    const cards = parseFlashcards(markdown);
    expect(cards).toHaveLength(1);
  });

  it("ignores #card markers inside database blocks", () => {
    const markdown = `::::
#card
Question in database?
Answer: hidden
#endcard
::::

#card
Visible question?
Answer: visible
#endcard`;

    const cards = parseFlashcards(markdown);
    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("Visible question?");
      expect(part.back).toBe("visible");
    }
  });

  it("parses multi-line options with fenced code blocks", () => {
    const markdown = `#card
Question with code options?
a) Plain option
b)
\`\`\`sql
-b
SELECT * FROM users;
\`\`\`
c) \`\`\`js
console.log("hi");
\`\`\`
d) Done
-d
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.correctKeys).toEqual(["d"]);
      const optionB = part.options.find((option) => option.key === "b");
      const optionC = part.options.find((option) => option.key === "c");
      expect(optionB?.text ?? "").toContain("```sql");
      expect(optionB?.text ?? "").toContain("-b");
      expect(optionC?.text ?? "").toContain("```js");
    }
  });

  it("parses table options as one selectable block", () => {
    const markdown = `#card
Which table is valid?
a)
| Name | Value |
| --- | --- |
| Alpha | 1 |
| Beta | 2 |
b) Another option
-a
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.correctKeys).toEqual(["a"]);
      const optionA = part.options.find((option) => option.key === "a");
      expect(optionA?.text ?? "").toContain("| Name | Value |");
      expect(optionA?.text ?? "").toContain("| --- | --- |");
      expect(optionA?.text ?? "").toContain("| Beta | 2 |");
    }
  });

  it("parses multiple cards in one document", () => {
    const markdown = `Intro text.

#card
First question?
a) One
b) Two
-b
#endcard

Some notes between.

#card
Second question?
a) Alpha
b) Beta
#endcard`;

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

  it("returns source ranges including wrapper lines", () => {
    const markdown = [
      "Intro",
      "#card",
      "First question?",
      "Answer: one",
      "#endcard",
      "",
      "#card",
      "Second question?",
      "Answer: two",
      "#endcard",
    ].join("\n");

    const entries = parseFlashcardEntries(markdown);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.sourceRange).toEqual({ startLine: 1, endLine: 4 });
    expect(entries[1]?.sourceRange).toEqual({ startLine: 6, endLine: 9 });
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
Use %token% with "drag".
#endcard`;

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

  it("extracts card media per part without affecting type detection", () => {
    const markdown = `#card
![[images/qa.png]]
Question one?
Answer: One

![[images/tf.png]]
Statement two
-true

![[images/m1.png]]
Pick one.
a) First
b) Second
-a

![[images/m2.png]]
Pick two.
a) Alpha
b) Beta
c) Gamma
-a
-c

![[images/cloze.png]]
Use %token% with "drag".
#endcard`;

    const cards = parseFlashcards(markdown, { answerMatch: "line-start" });

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts.map((part) => part.kind)).toEqual([
      "free-text",
      "true-false",
      "multiple-choice",
      "multiple-choice",
      "cloze",
    ]);
    parts.forEach((part) => {
      expect(part.media).toHaveLength(1);
      expect(part.media?.[0]).toMatchObject({ type: "png" });
    });
  });

  it("keeps inline embed syntax as plain text and does not extract media", () => {
    const markdown = `#card
Question with inline ![[images/inline.png]] marker
Answer: Real
#endcard`;

    const cards = parseFlashcards(markdown, { answerMatch: "line-start" });
    expect(cards).toHaveLength(1);

    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toContain("![[images/inline.png]]");
      expect(part.media).toBeUndefined();
    }
  });

  it("parses inline answer parts inside a composite card", () => {
    const markdown = `#card
Inline question? Answer: Inline answer.

Pick one.
a) First
b) Second
-a
#endcard`;

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
#endcard`;

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

  it("keeps '# Title' lines inside a card and uses '#endcard' as the only terminator", () => {
    const markdown = `#card
# Heading inside
Answer: heading text stays inside
#endcard
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
#endcard
`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toContain("#exam");
    }
  });

  it("preserves pipe tables with in-cell card/exam tags for multiple choice", () => {
    const table = `| qa | tf | m1 | m2 | cl | cd | cld |       |
| --- | --- | --- | --- | --- | --- | --- | ----- |
| Y | N | N | N | Y | Y | Y | #exam |
| Y | N | N | N | Y | Y | Y | #card |`;
    const markdown = `#card
Tabellen Raenderring ok/no

${table}
a) Alpha
-a
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.context).toBeTruthy();
      expect(part.context ?? "").toContain(table);
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
Cloze chain: %first% and "token".
---
QA check.
Answer: Confirmed.
#endcard
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

  it("parses cloze tokens inside table cells", () => {
    const markdown = `#card
| Term | Answer |
| --- | --- |
| Alpha | %first% |
| Beta | "second" |
| Gamma | "third" and %fourth% |
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      const blanks = part.segments.filter(
        (segment): segment is Extract<ClozeSegment, { type: "blank" }> =>
          segment.type === "blank",
      );
      expect(blanks).toHaveLength(4);
      expect(blanks.map((blank) => blank.solution)).toEqual([
        "first",
        "second",
        "third",
        "fourth",
      ]);
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "second" },
        { id: "token-1", value: "third" },
      ]);
    }
  });

  it("keeps table headers when cloze markers are only in table rows", () => {
    const markdown = `#card
| Term | Answer |
| --- | --- |
| Alpha | %first% |
| Beta | "second" |
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      const rendered = part.segments
        .map((segment) =>
          segment.type === "text" ? segment.value : `@@${segment.solution}@@`,
        )
        .join("");
      const lines = rendered.split("\n");
      expect(lines[0]).toContain("| Term | Answer |");
      expect(lines[1]).toContain("| --- | --- |");
    }
  });

  it("parses cloze markers inside fenced code blocks", () => {
    const markdown = `#card
SQL cld example with %Outside% and "token".
\`\`\`sql
"SELECT" a.PLZ, a.ORT
"FROM" ADRESSE a
"WHERE" k.NAME = %Nachname%
\`\`\`
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.subtype).toBe("cld");
      const inputBlanks = part.segments.filter(
        (
          segment,
        ): segment is Extract<ClozeSegment, { type: "blank" }> & { kind: "input" } =>
          segment.type === "blank" && segment.kind === "input",
      );
      expect(inputBlanks.map((blank) => blank.solution)).toEqual([
        "Outside",
        "Nachname",
      ]);
      expect(part.dragTokens.map((token) => token.value)).toEqual([
        "token",
        "SELECT",
        "FROM",
        "WHERE",
      ]);
    }
  });

  it("keeps tables intact when splitting composite parts", () => {
    const markdown = `#card
| Term | Answer |
| --- | --- |
| Join | %inner% |
---
Second prompt?
Answer: Table stays in the first part.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    expect(parts[0].kind).toBe("cloze");
    expect(parts[1].kind).toBe("free-text");
  });

  it("keeps context tables for TF/M1/M2 example cards", () => {
    const markdown = `#card
2) Task (TF): Decide whether the statement is true or false. Use the context table below.

| Term | Quick meaning |
| --- | --- |
| Star | Produces its own light via fusion |
| Planet | Orbits a star and does not produce light via fusion |

Statement: The Sun is a star.
-true
#endcard

#card
3) Task (M1): Choose exactly one correct answer. Use the context table below.

| HTTP method | Typical intent |
| --- | --- |
| GET | Retrieve a resource |
| POST | Create or trigger processing |
| DELETE | Remove a resource |

Which HTTP method is typically used to retrieve (read) a resource?
a) POST
b) GET
c) DELETE
-b
#endcard

#card
4) Task (M2): Choose all correct answers. Use the context table below.

| Permission class | Abbreviation |
| --- | --- |
| User (owner) | u |
| Group | g |
| Others | o |

Which are permission classes in classic Unix permissions?
a) User (owner)
b) Group
c) Others
d) Process
-a
-b
-c
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(3);

    const tfPart = getSinglePart(cards[0]);
    expect(tfPart.kind).toBe("true-false");
    if (tfPart.kind === "true-false") {
      expect(tfPart.context).toBeTruthy();
      expect(tfPart.context ?? "").toContain("| Term | Quick meaning |");
      expect(tfPart.context ?? "").toContain("| --- | --- |");
      expect(tfPart.items[0]?.question).toBe("Statement: The Sun is a star.");
    }

    const m1Part = getSinglePart(cards[1]);
    expect(m1Part.kind).toBe("multiple-choice");
    if (m1Part.kind === "multiple-choice") {
      expect(m1Part.context).toBeTruthy();
      expect(m1Part.context ?? "").toContain("| HTTP method | Typical intent |");
      expect(m1Part.context ?? "").toContain("| --- | --- |");
      expect(m1Part.correctKeys).toEqual(["b"]);
      expect(m1Part.options).toHaveLength(3);
    }

    const m2Part = getSinglePart(cards[2]);
    expect(m2Part.kind).toBe("multiple-choice");
    if (m2Part.kind === "multiple-choice") {
      expect(m2Part.context).toBeTruthy();
      expect(m2Part.context ?? "").toContain("| Permission class | Abbreviation |");
      expect(m2Part.context ?? "").toContain("| --- | --- |");
      expect(m2Part.correctKeys).toEqual(["a", "b", "c"]);
      expect(m2Part.options).toHaveLength(4);
    }
  });

  it("parses a front/back card with Answer marker", () => {
    const markdown = `#card
What is SQL used for as a common interface?
Answer: SQL is used to define, manipulate, manage permissions, and handle transactions.
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard
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
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses true/false markers case-insensitively", () => {
    const markdown = `#card
Case check. Wahr/Falsch?
-FALSCH
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard`;

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
#endcard
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
Fill %one% and "alpha".
#endcard
---
#card
Second.
Only "beta".
#endcard`;

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

  it("parses cloze cards with % blanks", () => {
    const markdown = `#card
Define foreign key.
A foreign key is an % attribute or attribute set % that references a %primary key% in another % table %.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.subtype).toBe("cl");
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
%alpha% and % beta % then %gamma%.
#endcard`;

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

  it("parses chained input blanks as one blank with accepted alternatives", () => {
    const markdown = `#card
Normalformen.
Die %1NF%%1 Normalform%%erste Normalform% fordert %atomare% Werte.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.segments).toEqual([
        { type: "text", value: "Die " },
        {
          type: "blank",
          id: "blank-0",
          kind: "input",
          solution: "1NF",
          acceptedSolutions: ["1 Normalform", "erste Normalform"],
        },
        { type: "text", value: " fordert " },
        { type: "blank", id: "blank-1", kind: "input", solution: "atomare" },
        { type: "text", value: " Werte." },
      ]);
    }
  });

  it("parses quoted drag tokens", () => {
    const markdown = `#card
Drag token example.
Use "Paris".
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([{ id: "token-0", value: "Paris" }]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "Paris" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("treats backticks as inline code", () => {
    const markdown = `#card
Inline code sample.
Use %answer% with \`foo()\`.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " with `foo()`." },
      ]);
    }
  });

  it("ignores cloze markers inside inline code spans", () => {
    const markdown = `#card
Inline code only: \`"alpha"\` and \`%beta%\`.
Outside "gamma" and %delta%.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.question).toBe(
        'Inline code only: `"alpha"` and `%beta%`.',
      );
      const blanks = part.segments.filter((segment) => segment.type === "blank");
      expect(blanks).toHaveLength(2);
      expect(part.dragTokens.map((token) => token.value)).toEqual(["gamma"]);
      const inputBlanks = blanks.filter((blank) => blank.kind === "input");
      expect(inputBlanks.map((blank) => blank.solution)).toEqual(["delta"]);
    }
  });

  it("parses markers inside fenced code blocks even with backticks", () => {
    const markdown = `#card
Code sample:
\`\`\`js
const q = \`SELECT %col% FROM "table"\`;
\`\`\`
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      const blanks = part.segments.filter((segment) => segment.type === "blank");
      expect(blanks.map((blank) => blank.solution)).toEqual(["col", "table"]);
      expect(part.dragTokens.map((token) => token.value)).toEqual(["table"]);
    }
  });

  it("combines typed blanks with drag tokens", () => {
    const markdown = `#card
Mixed cloze.
%Answer% and "Token".
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.subtype).toBe("cld");
      expect(part.dragTokens).toEqual([{ id: "token-0", value: "Token" }]);
      expect(part.segments).toEqual([
        { type: "blank", id: "blank-0", kind: "input", solution: "Answer" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "Token" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("collects drag tokens alongside blanks", () => {
    const markdown = `#card
Mixed markers.
Use %blank% with "alpha" and "beta".
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.subtype).toBe("cld");
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

  it("keeps cards with only drag tokens", () => {
    const markdown = `#card
Only tokens.
Use "alpha" and "beta" here.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.subtype).toBe("cd");
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
Use "same" and "same" again.
#endcard`;

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

  it("handles unclosed % safely", () => {
    const markdown = `#card
Broken markers.
Valid %answer% and %unfinished.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and %unfinished." },
      ]);
    }
  });

  it("handles unclosed drag tokens safely", () => {
    const markdown = `#card
Broken token.
Valid %answer% and "unfinished.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and \"unfinished." },
      ]);
    }
  });

  it("parses markers inside fenced code blocks", () => {
    const markdown = `#card
Question.
Code:
~~~
"ignored"
%not%
~~~
Outside "token" and %blank%.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "ignored" },
        { id: "token-1", value: "token" },
      ]);
      const blanks = part.segments.filter((segment) => segment.type === "blank");
      expect(blanks).toEqual([
        { type: "blank", id: "blank-0", kind: "drag", solution: "ignored" },
        { type: "blank", id: "blank-1", kind: "input", solution: "not" },
        { type: "blank", id: "blank-2", kind: "drag", solution: "token" },
        { type: "blank", id: "blank-3", kind: "input", solution: "blank" },
      ]);
    }
  });

  it("parses tables with fenced sql blocks in cld prompts", () => {
    const markdown = `#card
Query overview:
| Column | Value |
| --- | --- |
| min | %min_bestellungen% |
| note | text |
\`\`\`sql
SELECT "COUNT"(*) FROM orders
WHERE column = %sort_spalte%
\`\`\`
Outside token: "SELECT"
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      const blanks = part.segments.filter(
        (
          segment,
        ): segment is Extract<ClozeSegment, { type: "blank" }> & { kind: "input" } =>
          segment.type === "blank" && segment.kind === "input",
      );
      expect(blanks.map((blank) => blank.solution)).toEqual([
        "min_bestellungen",
        "sort_spalte",
      ]);
      expect(part.dragTokens.map((token) => token.value)).toEqual([
        "COUNT",
        "SELECT",
      ]);
    }
  });

  it("skips cards with empty blanks", () => {
    const markdown = `#card
Empty blank.
% %
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses multiple fenced blocks in one prompt", () => {
    const markdown = `#card
Before %first%.
\`\`\`
"token1"
%inside%
\`\`\`
Between "token2".
~~~sql
%second%
~~~
After.
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      const blanks = part.segments.filter(
        (
          segment,
        ): segment is Extract<ClozeSegment, { type: "blank" }> & { kind: "input" } =>
          segment.type === "blank" && segment.kind === "input",
      );
      expect(blanks.map((blank) => blank.solution)).toEqual([
        "first",
        "inside",
        "second",
      ]);
      expect(part.dragTokens.map((token) => token.value)).toEqual([
        "token1",
        "token2",
      ]);
    }
  });

  it("stores help blocks without affecting detection", () => {
    const markdown = `#card
Question?
#help
-true
Answer: decoy
#helpend
Answer: Real answer
#endcard`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.helpText?.length).toBe(1);
    expect(cards[0]?.helpText?.[0]).toContain("-true");
    expect(cards[0]?.helpText?.[0]).toContain("Answer: decoy");
    expect(cards[0]?.detectedTypes).toEqual(["qa"]);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.back).toBe("Real answer");
    }
  });

  it("matches input blanks case-insensitively with trim", () => {
    expect(isInputAnswerMatch(" Atomic Values ", "atomic values")).toBe(true);
    expect(isInputAnswerMatch("Atomic", "atom")).toBe(false);
    expect(
      isInputAnswerMatch("erste normalform", "1NF", [
        "1 Normalform",
        "erste Normalform",
      ]),
    ).toBe(true);
    expect(
      isInputAnswerMatch("3NF", "1NF", ["1 Normalform", "erste Normalform"]),
    ).toBe(false);
  });

  it("matches drag tokens by trimmed exact value", () => {
    expect(isDragAnswerMatch("Token", "Token")).toBe(true);
    expect(isDragAnswerMatch("Token ", "Token")).toBe(true);
    expect(isDragAnswerMatch("token", "Token")).toBe(false);
  });
});

describe("parseFlashcards Canvas isolation", () => {
  it("ignores flashcard-looking markers inside Canvas blocks", () => {
    const markdown = [
      "#canvas",
      "{",
      "  \"nodes\": [",
      "    {",
      "      \"id\": \"node-1\",",
      "      \"type\": \"text\",",
      "      \"text\": \"#card\\nQuestion?\\nAnswer: Wrong\\n#endcard\",",
      "      \"x\": 0,",
      "      \"y\": 0,",
      "      \"width\": 240,",
      "      \"height\": 120",
      "    }",
      "  ],",
      "  \"edges\": []",
      "}",
      "#canvasend",
      "",
      "#card",
      "Real question?",
      "Answer: Real answer",
      "#endcard",
    ].join("\n");

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("Real question?");
      expect(part.back).toBe("Real answer");
    }
  });

  it("does not split card segments on separators inside Canvas blocks", () => {
    const markdown = [
      "#card",
      "Question before canvas?",
      "#canvas",
      "{",
      "  \"nodes\": [{ \"id\": \"node-1\", \"type\": \"text\", \"text\": \"---\", \"x\": 0, \"y\": 0, \"width\": 100, \"height\": 80 }],",
      "  \"edges\": []",
      "}",
      "#canvasend",
      "Answer: Stable",
      "#endcard",
    ].join("\n");

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.back).toBe("Stable");
    }
  });
});
