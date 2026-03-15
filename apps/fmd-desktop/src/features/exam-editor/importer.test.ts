/**
 * @file apps/fmd-desktop/src/features/exam-editor/importer.test.ts
 */

import { describe, expect, it } from "vitest";
import { importExamMarkdown } from "./importer";
import { serializeExamBlueprint } from "./serializer";

const compositeMarkdown = `
#exam
1) Composite
#card
#help
Use formula.
#helpend
Question one
Answer: One
---
Statement two
-true
#endcard
2) Solo
Question two
Answer: Two
#endexam
`.trim();

describe("importExamMarkdown", () => {
  it("keeps exam description marker-free and enables wrapper for pre-attached #card", () => {
    const markdown = `
#exam
#card
1) TAKS1-TITEL
#help
CARD M2 HELP / HINT
#helpend
TASK1 DESCRIPTION
a) OPTIONS A
b) OPTIONS B
c) OPTIONS C
d) OPTIONS D
-b
-c
#help
TASK1 HELP / HINT
#helpend
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.description).toBe("");
    expect(imported.blueprint.description).not.toMatch(
      /#card|#endcard|#exam|#endexam|#help|#helpend/m,
    );
    expect(imported.blueprint.tasks).toHaveLength(1);
    const task = imported.blueprint.tasks[0];
    expect(task?.useCardWrapper).toBe(true);
    expect(task?.title).toBe("TAKS1-TITEL");
    expect(task?.cards[0]?.prompt ?? "").not.toContain("TAKS1-TITEL");
  });

  it("detects task wrapper only when the card block fully wraps the task body", () => {
    const cases: Array<{ name: string; taskLines: string[]; expected: boolean }> = [
      {
        name: "wrapper starts inside task and closes at end",
        taskLines: ["1) Wrapped inside", "#card", "Question?", "Answer: A", "#endcard"],
        expected: true,
      },
      {
        name: "missing closing marker",
        taskLines: ["1) Missing close", "#card", "Question?", "Answer: A"],
        expected: false,
      },
      {
        name: "trailing content after closing marker is canonically wrapped",
        taskLines: [
          "1) Trailing content",
          "#card",
          "Question?",
          "Answer: A",
          "#endcard",
          "Still content",
        ],
        expected: true,
      },
      {
        name: "markdown heading is not a closing marker",
        taskLines: ["1) Heading close", "#card", "Question?", "Answer: A", "# Title"],
        expected: false,
      },
    ];

    cases.forEach(({ name, taskLines, expected }) => {
      const markdown = ["#exam", ...taskLines, "#endexam"].join("\n");
      const imported = importExamMarkdown(markdown);
      expect(imported).not.toBeNull();
      if (!imported) {
        throw new Error(`Expected import result for case: ${name}`);
      }
      expect(imported.blueprint.tasks[0]?.useCardWrapper).toBe(expected);
    });
  });

  it("rewrites internal wrapper markers to canonical placement on serialize", () => {
    const markdown = [
      "#exam",
      "1) Legacy",
      "#card",
      "Question?",
      "Answer: A",
      "#endcard",
      "#endexam",
    ].join("\n");

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const serialized = serializeExamBlueprint(imported.blueprint);
    expect(serialized).toContain("#card\n1) Legacy");
    expect(serialized).toContain("#endcard");
    expect((serialized.match(/^#card$/gm) ?? []).length).toBe(1);
    expect(serialized).not.toContain("1) Legacy\n#card");
  });

  it("preserves composite tasks and task-level wrapper", () => {
    const imported = importExamMarkdown(compositeMarkdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    const [first, second] = imported.blueprint.tasks;
    if (!first || !second) {
      throw new Error("Expected two tasks after import.");
    }
    expect(first.cards).toHaveLength(2);
    expect(first.useCardWrapper).toBe(true);
    expect(first.cards[0]?.type).toBe("qa");
    expect(first.cards[1]?.type).toBe("tf");
    expect(first.cards[0]?.helpText).toBe("Use formula.");
    expect(second.useCardWrapper).toBe(false);
  });

  it("accepts case-insensitive exam wrappers", () => {
    const markdown = `
#EXAM
1) Uppercase wrapper
Answer: A
#EnDeXaM
    `.trim();
    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
  });

  it("roundtrips composite tasks without splitting parts", () => {
    const imported = importExamMarkdown(compositeMarkdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const serialized = serializeExamBlueprint(imported.blueprint);
    const roundtrip = importExamMarkdown(serialized);
    expect(roundtrip).not.toBeNull();
    if (!roundtrip) {
      return;
    }

    expect(roundtrip.blueprint.tasks).toHaveLength(2);
    expect(roundtrip.blueprint.tasks[0]?.cards).toHaveLength(2);
    expect(roundtrip.blueprint.tasks[0]?.useCardWrapper).toBe(true);
    expect(serialized.match(/^#card$/gm)?.length ?? 0).toBe(1);
    expect(serialized.match(/^#endcard$/gm)?.length ?? 0).toBe(1);
    expect(serialized).toContain("---");
  });

  it("roundtrips card media blocks for composite tasks", () => {
    const markdown = `
#exam
1) Media
#card
![[images/example.png]]
Question one
Answer: One
---
\`\`\`svg
<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>
\`\`\`
Statement two
-true
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const [task] = imported.blueprint.tasks;
    expect(task).toBeDefined();
    if (!task) {
      return;
    }
    expect(task.cards).toHaveLength(2);
    const [firstCard, secondCard] = task.cards;
    expect(firstCard).toBeDefined();
    expect(secondCard).toBeDefined();
    if (!firstCard || !secondCard) {
      return;
    }
    const firstMediaItems = firstCard.mediaItems;
    const secondMediaItems = secondCard.mediaItems;
    expect(firstMediaItems).toBeDefined();
    expect(secondMediaItems).toBeDefined();
    if (!firstMediaItems || !secondMediaItems) {
      return;
    }
    expect(firstMediaItems[0]).toMatchObject({
      type: "png",
      src: "images/example.png",
    });
    expect(secondMediaItems[0]?.inlineSvg).toContain("circle");

    const serialized = serializeExamBlueprint(imported.blueprint);
    expect(serialized).toContain("![[images/example.png]]");
    expect(serialized).toContain("```svg");

    const roundtrip = importExamMarkdown(serialized);
    expect(roundtrip).not.toBeNull();
    if (!roundtrip) {
      return;
    }

    const [roundtripTask] = roundtrip.blueprint.tasks;
    expect(roundtripTask).toBeDefined();
    if (!roundtripTask) {
      return;
    }
    const [roundtripFirstCard, roundtripSecondCard] = roundtripTask.cards;
    expect(roundtripFirstCard).toBeDefined();
    expect(roundtripSecondCard).toBeDefined();
    if (!roundtripFirstCard || !roundtripSecondCard) {
      return;
    }
    const roundtripFirstMediaItems = roundtripFirstCard.mediaItems;
    const roundtripSecondMediaItems = roundtripSecondCard.mediaItems;
    expect(roundtripFirstMediaItems).toBeDefined();
    expect(roundtripSecondMediaItems).toBeDefined();
    if (!roundtripFirstMediaItems || !roundtripSecondMediaItems) {
      return;
    }
    expect(roundtripFirstMediaItems[0]).toMatchObject({
      type: "png",
      src: "images/example.png",
    });
    expect(roundtripSecondMediaItems[0]?.inlineSvg).toContain("circle");
  });

  it("migrates task-level media into the first card media list", () => {
    const markdown = `
#exam
1) Task media migration
![[images/task.png|Task image]]
#card
Question?
Answer: A
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task).toBeDefined();
    if (!task) {
      return;
    }
    expect(task.mediaItems).toBeUndefined();
    const firstCard = task.cards[0];
    expect(firstCard).toBeDefined();
    if (!firstCard) {
      return;
    }
    expect(firstCard.mediaItems?.[0]).toMatchObject({
      type: "png",
      src: "images/task.png",
    });

    const serialized = serializeExamBlueprint(imported.blueprint);
    const occurrences = serialized.match(/!\[\[images\/task\.png(?:\|[^\]]+)?\]\]/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it("keeps card media first and appends migrated task media", () => {
    const markdown = `
#exam
1) Media order
![[images/task.png|Task image]]
#card
![[images/card.png|Card image]]
Question?
Answer: A
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task).toBeDefined();
    if (!task) {
      return;
    }
    expect(task.mediaItems).toBeUndefined();
    const firstCard = task.cards[0];
    expect(firstCard).toBeDefined();
    if (!firstCard) {
      return;
    }
    const mediaSources = (firstCard.mediaItems ?? []).map((item) => item.src);
    expect(mediaSources).toEqual(["images/card.png", "images/task.png"]);
  });

  it("keeps task media when fallback card creation is used", () => {
    const markdown = `
#exam
1) Fallback media
![[images/task-fallback.png]]
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task).toBeDefined();
    if (!task) {
      return;
    }
    expect(task.cards).toHaveLength(1);
    expect(task.mediaItems).toBeUndefined();
    const firstCard = task.cards[0];
    expect(firstCard).toBeDefined();
    if (!firstCard) {
      return;
    }
    expect(firstCard.mediaItems?.[0]).toMatchObject({
      type: "png",
      src: "images/task-fallback.png",
    });
  });

  it("keeps unparseable wrapped blocks with media and table content", () => {
    const markdown = `
#exam
#card
1) Preserve unparseable
![[images/diagram.png]]
Just context without explicit answer marker.
| A | B |
| --- | --- |
| left | right |
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task).toBeDefined();
    if (!task) {
      return;
    }
    expect(task.useCardWrapper).toBe(true);
    expect(task.cards).toHaveLength(1);
    const card = task.cards[0];
    expect(card).toBeDefined();
    if (!card) {
      return;
    }
    expect(card.type).toBe("qa");
    if (card.type !== "qa") {
      throw new Error("Expected QA fallback card");
    }
    expect(card.prompt).toContain("Just context without explicit answer marker.");
    expect(card.prompt).toContain("| left | right |");
    expect(card.answer).toBe("");
    expect(card.mediaItems?.[0]).toMatchObject({
      type: "png",
      src: "images/diagram.png",
    });

    const serialized = serializeExamBlueprint(imported.blueprint);
    expect(serialized).toContain("#card\n1) Preserve unparseable");
    expect(serialized).toContain("![[images/diagram.png]]");
    expect(serialized).toContain("| left | right |");
    expect(serialized).not.toContain("![[images/diagram.png]]\n#endcard");
    expect(serialized).toMatch(/\n#endcard\n---\n#endexam$/);
  });

  it("keeps media-only wrapped blocks instead of dropping them", () => {
    const markdown = `
#exam
1) Media only fallback
#card
![[images/only-media.png]]
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task).toBeDefined();
    if (!task) {
      return;
    }
    expect(task.cards).toHaveLength(1);
    const card = task.cards[0];
    expect(card).toBeDefined();
    if (!card) {
      return;
    }
    expect(card.type).toBe("qa");
    if (card.type !== "qa") {
      throw new Error("Expected QA fallback card");
    }
    expect(card.prompt).toBe("");
    expect(card.answer).toBe("");
    expect(card.mediaItems?.[0]).toMatchObject({
      type: "png",
      src: "images/only-media.png",
    });
  });

  it("keeps wrapper toggles idempotent across serialize/import cycles", () => {
    const markdown = `
#exam
1) Toggle wrapper
#help
Task hint
#helpend
#card
Question?
Answer: A
#help
Card hint
#helpend
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }
    const originalTask = imported.blueprint.tasks[0];
    expect(originalTask?.useCardWrapper).toBe(true);

    const withoutWrapper = {
      ...imported.blueprint,
      tasks: imported.blueprint.tasks.map((task) => ({
        ...task,
        useCardWrapper: false,
      })),
    };
    const serializedOff = serializeExamBlueprint(withoutWrapper);
    expect(serializedOff).not.toMatch(/^#card$/m);
    expect(serializedOff).not.toMatch(/^#endcard$/m);
    expect(serializedOff).toContain("Task hint");
    expect(serializedOff).toContain("Card hint");

    const offRoundtrip = importExamMarkdown(serializedOff);
    expect(offRoundtrip).not.toBeNull();
    if (!offRoundtrip) {
      return;
    }
    expect(offRoundtrip.blueprint.tasks[0]?.useCardWrapper).toBe(false);

    const withWrapperAgain = {
      ...offRoundtrip.blueprint,
      tasks: offRoundtrip.blueprint.tasks.map((task) => ({
        ...task,
        useCardWrapper: true,
      })),
    };
    const serializedOn = serializeExamBlueprint(withWrapperAgain);
    expect(serializedOn.match(/^#card$/gm)?.length ?? 0).toBe(1);
    expect(serializedOn.match(/^#endcard$/gm)?.length ?? 0).toBe(1);
    expect(serializedOn).toContain("Task hint");
    expect(serializedOn).toContain("Card hint");

    const onRoundtrip = importExamMarkdown(serializedOn);
    expect(onRoundtrip).not.toBeNull();
    if (!onRoundtrip) {
      return;
    }
    expect(onRoundtrip.blueprint.tasks[0]?.useCardWrapper).toBe(true);
    expect(onRoundtrip.blueprint.description).not.toMatch(
      /#card|#endcard|#exam|#endexam|#help|#helpend/m,
    );
  });

  it("removes duplicated task numbers from content on roundtrip", () => {
    const markdown = `
#exam
1) First task
1) Question line
Answer: A
2) Second task
2) Another question
Answer: B
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const serialized = serializeExamBlueprint(imported.blueprint);
    const numberLines = serialized.split("\n").filter((line) => /^\d+\)/.test(line));
    expect(numberLines).toHaveLength(2);
    expect(serialized).toContain("Question line");
    expect(serialized).toContain("Another question");
    expect(serialized).not.toContain("\n1) Question line");
    expect(serialized).not.toContain("\n2) Another question");
  });

  it("keeps heading separate from description", () => {
    const markdown = `
#exam
2) Task heading
Task description
Answer: A
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    if (!task) {
      throw new Error("Expected task after import.");
    }
    expect(task.title).toBe("Task heading");
    const card = task.cards[0];
    if (card?.type === "qa") {
      expect(card.prompt).toBe("Task description");
    }
  });

  it("imports cld tasks with tables and tokens", () => {
    const markdown = `
#exam
1) Table CLD
#card
Fill %col% using "token".
| Col | Value |
| --- | --- |
| A | "alpha" |
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    if (!task) {
      throw new Error("Expected task after import.");
    }
    expect(task.cards).toHaveLength(1);
    const card = task.cards[0];
    expect(card?.type).toBe("cld");
    if (card?.type === "cld") {
      expect(card.prompt).toContain("| Col | Value |");
      expect(card.prompt).toContain('"alpha"');
    }
  });

  it("imports task help at start and end of tasks", () => {
    const markdown = `
#exam
1) Start help
#help
Start hint
#helpend
Question?
Answer: A
---
2) End help
Question?
Answer: B
#help
End hint
#helpend
---
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    expect(imported.blueprint.tasks[0]?.helpText).toBeUndefined();
    expect(imported.blueprint.tasks[1]?.helpText).toBeUndefined();
    expect(imported.blueprint.tasks[0]?.cards[0]?.helpText).toBe("Start hint");
    expect(imported.blueprint.tasks[1]?.cards[0]?.helpText).toBe("End hint");
  });

  it("keeps card help separate from task help", () => {
    const markdown = `
#exam
5) Task5
#help
Card M1 help
#helpend
Task description
a) Alpha
-a
---
#help
Card TF help
#helpend
Task TF description
-false
#help
Task help
#helpend
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    if (!task) {
      throw new Error("Expected task after import.");
    }
    expect(task.helpText).toBeUndefined();
    expect(task.cards[0]?.helpText).toBe("Card M1 help\n\nTask help");
    expect(task.cards[1]?.helpText).toBe("Card TF help");
  });

  it("maps early wrapper task help into first card help", () => {
    const markdown = `
#exam
#card
1) Wrapped help
#help
Wrapper task hint
#helpend
Question?
Answer: A
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task).toBeDefined();
    if (!task) {
      return;
    }
    expect(task.useCardWrapper).toBe(true);
    expect(task.helpText).toBeUndefined();
    expect(task.cards[0]?.helpText).toBe("Wrapper task hint");
  });

  it("ignores task help markers inside fenced code blocks", () => {
    const markdown = `
#exam
1) Task with fence
\`\`\`sql
#help
Not help
#helpend
\`\`\`
Question?
Answer: A
---
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(1);
    expect(imported.blueprint.tasks[0]?.helpText).toBeUndefined();
  });

  it("ignores orphan context between tasks separated by ---", () => {
    const markdown = `
#exam
8) Some task
Antwort: Some answer
---
## Abschnitt 3: Erlaeuterungsfrage (qa)
9) Next task
Antwort: Next answer
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    expect(imported.blueprint.tasks[0]?.cards).toHaveLength(1);
    expect(imported.blueprint.tasks[1]?.cards).toHaveLength(1);
    const firstTask = imported.blueprint.tasks[0];
    expect(firstTask).toBeDefined();
    if (!firstTask) {
      return;
    }
    const firstCard = firstTask.cards[0];
    expect(firstCard?.type).toBe("qa");
    if (firstCard?.type === "qa") {
      expect(firstCard.prompt).not.toContain("Abschnitt 3");
    }
  });

  it("does not create QA cards from headings without separators", () => {
    const markdown = `
#exam
1) First task
Question?
Answer: A
## Abschnitt heading
2) Second task
Answer: B
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(2);
    expect(imported.blueprint.tasks[0]?.cards).toHaveLength(1);
    expect(imported.blueprint.tasks[1]?.cards).toHaveLength(1);
  });

  it("does not create tasks from dot-numbered headings inside exam blocks", () => {
    const markdown = `
#exam
1. First heading
2. Second heading
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(0);
  });

  it("keeps dot-numbered lines as plain text while preserving card-type parsing", () => {
    const markdown = `
#exam
1) Main task
#card
1. Begriffsabgrenzung
Ordne die Begriffe "Datenbank" und "DBMS" zu.
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(1);
    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    expect(task?.cards[0]?.type).toBe("cd");
    if (task?.cards[0]?.type === "cd") {
      expect(task.cards[0].prompt).toContain("Begriffsabgrenzung");
      expect(task.cards[0].prompt).not.toContain("1. Begriffsabgrenzung");
    }
  });

  it("removes dot-numbered markers from headings in imported exam card content", () => {
    const markdown = `
#exam
1) Main task
#card
## 3. Relationales Modell
Beschreibung
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const card = imported.blueprint.tasks[0]?.cards[0];
    if (card?.type === "qa" || card?.type === "cd" || card?.type === "cld") {
      expect(card.prompt).toContain("## Relationales Modell");
      expect(card.prompt).not.toContain("## 3. Relationales Modell");
    }
  });

  it("splits dot-numbered task blocks on --- instead of collapsing into one QA card", () => {
    const markdown = `
#exam
1) Main task
#card
1. Begriffsabgrenzung
Tabellenstruktur (Beispiel DBMS)
| Begriff | Beschreibung |
| --- | --- |
| "Datenbank" | Speichert strukturierte Daten |
| "DBMS" | Verwalten Zugriffe |
---
a) Sollte als M1 erkannt werden
b) Ablenkoption
-a
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(1);
    const task = imported.blueprint.tasks[0];
    if (!task) {
      throw new Error("Expected task after import.");
    }
    expect(task.cards).toHaveLength(2);
    expect(task.cards[1]?.type).toBe("m1");
    const firstCard = task.cards[0];
    if (firstCard?.type === "qa" || firstCard?.type === "cd" || firstCard?.type === "cld") {
      expect(firstCard.prompt).toContain("Begriffsabgrenzung");
      expect(firstCard.prompt).not.toContain("1. Begriffsabgrenzung");
    }
  });

  it("keeps dot-numbered block content intact across --- splits", () => {
    const markdown = `
#exam
1) Main task
#card
Einleitung
---
2. Unterpunkt
---
Abschlussfrage?
Answer: Gesamtantwort
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(1);
    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(3);
    const secondCard = task?.cards[1];
    if (secondCard?.type === "qa") {
      expect(secondCard.prompt).toContain("Unterpunkt");
      expect(secondCard.prompt).not.toContain("2. Unterpunkt");
    }
    const thirdCard = task?.cards[2];
    if (thirdCard?.type === "qa") {
      expect(thirdCard.answer).toBe("Gesamtantwort");
    }
  });

  it("does not import orphan dot-numbered sections as extra cards after task separators", () => {
    const markdown = `
#exam
1) Begriffsabgrenzung
Tabellenstruktur (Beispiel DBMS)
| Begriff | Beschreibung |
| --- | --- |
| "Datenbank" | Speichert strukturierte Daten |
| "DBMS" | Verwalten Zugriffe |
---
## 3. Relationales Modell: Aufbau und Struktur
Text, der nicht als neue Aufgabe importiert werden darf.
---
## 4. Relationen und Schluessel
Mehr Kontext ohne 2)-Header.
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    expect(imported.blueprint.tasks).toHaveLength(1);
    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    const card = task?.cards[0];
    if (card?.type === "qa" || card?.type === "cd" || card?.type === "cld") {
      expect(card.prompt).toContain("Begriffsabgrenzung");
      expect(card.prompt).not.toContain("Relationales Modell");
      expect(card.prompt).not.toContain("Relationen und Schluessel");
    }
  });

  it("does not treat decimal values as dot-numbered markers", () => {
    const markdown = `
#exam
1) Decimal task
#card
Wert 1.5 bleibt normaler Text.
a) Alpha
-a
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const card = imported.blueprint.tasks[0]?.cards[0];
    expect(card?.type).toBe("m1");
  });

  it("does not split on --- inside fenced code blocks", () => {
    const markdown = `
#exam
1) Task with fence
#card
Question?
\`\`\`md
---
\`\`\`
Answer: A
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    const card = task?.cards[0];
    if (card?.type === "qa") {
      expect(card.prompt).toContain("```");
      expect(card.prompt).toContain("---");
    }
  });

  it("does not split on --- inside tables", () => {
    const markdown = `
#exam
1) Table task
#card
Question?
| Key | Value |
| --- | --- |
| A | --- |
Answer: A
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    const card = task?.cards[0];
    if (card?.type === "qa") {
      expect(card.prompt).toContain("| Key | Value |");
      expect(card.prompt).toContain("| A | --- |");
    }
  });

  it("ignores orphan blocks without answer markers after task separators", () => {
    const markdown = `
#exam
1) Task
Question?
Answer: A
---
Just context without an answer marker.
---
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    expect(task?.cards).toHaveLength(1);
    expect(task?.cards[0]?.type).toBe("qa");
    if (task?.cards[0]?.type === "qa") {
      expect(task.cards[0].prompt).not.toContain("Just context without an answer marker.");
    }
  });

  it("does not treat legacy #media metadata blocks as media", () => {
    const markdown = `
#exam
1) Legacy media task
#card
#media
type: png
src: images/example.png
#mediaend
Question?
Answer: Real
#endcard
#endexam
    `.trim();

    const imported = importExamMarkdown(markdown);
    expect(imported).not.toBeNull();
    if (!imported) {
      return;
    }

    const task = imported.blueprint.tasks[0];
    const card = task?.cards[0];
    expect(card?.mediaItems ?? []).toHaveLength(0);
    if (card?.type === "qa") {
      expect(card.prompt).toContain("#media");
      expect(card.prompt).toContain("src: images/example.png");
    }
  });
});
