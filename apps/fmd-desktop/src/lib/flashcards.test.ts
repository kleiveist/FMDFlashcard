import { describe, expect, it } from "vitest";
import { isClozeAnswerMatch, parseFlashcards } from "./flashcards";

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
      expect(cards[0].answers).toEqual([
        "attribute or attribute set",
        "primary key",
        "table",
      ]);
      expect(cards[0].segments).toEqual([
        { type: "text", value: "A foreign key is an " },
        { type: "blank", answer: "attribute or attribute set" },
        { type: "text", value: " that references a " },
        { type: "blank", answer: "primary key" },
        { type: "text", value: " in another " },
        { type: "blank", answer: "table" },
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
      expect(cards[0].answers).toEqual(["alpha", "beta", "gamma"]);
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
      expect(cards[0].answers).toEqual(["answer"]);
      expect(cards[0].segments.at(-1)).toEqual({
        type: "text",
        value: " and %%unfinished.",
      });
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

  it("matches cloze answers case-insensitively with trim", () => {
    expect(isClozeAnswerMatch(" Atomic Values ", "atomic values")).toBe(true);
    expect(isClozeAnswerMatch("Atomic", "atom")).toBe(false);
  });
});
