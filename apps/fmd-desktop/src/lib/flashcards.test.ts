import { describe, expect, it } from "vitest";
import { isDragAnswerMatch, isInputAnswerMatch, parseFlashcards } from "./flashcards";

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
    expect(cards[0].kind).toBe("multiple-choice");
    if (cards[0].kind === "multiple-choice") {
      expect(cards[0].question).toBe("1.5 Which SQL category controls access rights?");
      expect(cards[0].options).toEqual([
        { key: "a", text: "DML" },
        { key: "b", text: "DDL" },
        { key: "c", text: "TCL" },
        { key: "d", text: "DCL" },
      ]);
      expect(cards[0].correctKeys).toEqual(["d"]);
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
    expect(cards[0].kind).toBe("multiple-choice");
    expect(cards[1].kind).toBe("multiple-choice");
    if (cards[0].kind === "multiple-choice") {
      expect(cards[0].question).toBe("First question?");
    }
    if (cards[1].kind === "multiple-choice") {
      expect(cards[1].question).toBe("Second question?");
    }
  });

  it("parses a single true/false item", () => {
    const markdown = `#card
1. The earth orbits the sun. Wahr/Falsch?
-wahr
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("true-false");
    if (cards[0].kind === "true-false") {
      expect(cards[0].items).toEqual([
        {
          id: "tf-0",
          question: "1. The earth orbits the sun. Wahr/Falsch?",
          correct: "wahr",
        },
      ]);
    }
  });

  it("parses multiple true/false items in one card", () => {
    const markdown = `#card
2. Water boils at 100C. Wahr/Falsch?
-wahr
3. The moon is a planet. Wahr/Falsch?
-falsch
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("true-false");
    if (cards[0].kind === "true-false") {
      expect(cards[0].items).toEqual([
        {
          id: "tf-0",
          question: "2. Water boils at 100C. Wahr/Falsch?",
          correct: "wahr",
        },
        {
          id: "tf-1",
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
    expect(cards[0].kind).toBe("true-false");
    if (cards[0].kind === "true-false") {
      expect(cards[0].items[0]?.correct).toBe("falsch");
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
    expect(cards[0].kind).toBe("multiple-choice");
    if (cards[0].kind === "multiple-choice") {
      expect(cards[0].correctKeys).toEqual(["a", "d"]);
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
    expect(cards[0].kind).toBe("multiple-choice");
    if (cards[0].kind === "multiple-choice") {
      expect(cards[0].question).toBe("Question?");
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
    expect(cards[0].kind).toBe("cloze");
    expect(cards[1].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].dragTokens).toEqual([{ id: "token-0", value: "alpha" }]);
      expect(cards[0].segments).toEqual([
        { type: "text", value: "Fill " },
        { type: "blank", id: "blank-0", kind: "input", solution: "one" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "alpha" },
        { type: "text", value: "." },
      ]);
    }
    if (cards[1].kind === "cloze") {
      expect(cards[1].dragTokens).toEqual([{ id: "token-0", value: "beta" }]);
      expect(cards[1].segments).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].question).toBe("Define foreign key.");
      expect(cards[0].dragTokens).toEqual([]);
      expect(cards[0].segments).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].segments).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(cards[0].segments).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(cards[0].segments).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].dragTokens).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].dragTokens).toEqual([]);
      expect(cards[0].segments).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].dragTokens).toEqual([]);
      expect(cards[0].segments).toEqual([
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
    expect(cards[0].kind).toBe("cloze");
    if (cards[0].kind === "cloze") {
      expect(cards[0].dragTokens).toEqual([{ id: "token-0", value: "token" }]);
      const blanks = cards[0].segments.filter(
        (segment) => segment.type === "blank",
      );
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
