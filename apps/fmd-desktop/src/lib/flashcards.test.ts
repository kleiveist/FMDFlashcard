import { describe, expect, it } from "vitest";
import { parseFlashcards } from "./flashcards";

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
    expect(cards[0].question).toBe("1.5 Which SQL category controls access rights?");
    expect(cards[0].options).toEqual([
      { key: "a", text: "DML" },
      { key: "b", text: "DDL" },
      { key: "c", text: "TCL" },
      { key: "d", text: "DCL" },
    ]);
    expect(cards[0].correctKeys).toEqual(["d"]);
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
    expect(cards[0].question).toBe("First question?");
    expect(cards[1].question).toBe("Second question?");
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
    expect(cards[0].correctKeys).toEqual(["a", "d"]);
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
    expect(cards[0].question).toBe("Question?");
  });

  it("skips cards with missing end markers", () => {
    const markdown = `#card
Question without end?
a) Option`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });
});
