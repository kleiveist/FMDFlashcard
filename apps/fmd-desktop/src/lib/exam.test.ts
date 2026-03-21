/**
 * @file apps/fmd-desktop/src/lib/exam.test.ts
 *
 * Zweck:
 * - Testet exam.test und zugehoerige Logik.
 *
 * Verantwortlichkeiten:
 * - Prueft erwartetes Verhalten und Randfaelle.
 * - Sichert Regressionen fuer zentrale Szenarien.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/exam.ts: Hilfsfunktionen oder Typen.
 * - vitest: Externe Bibliothek.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import {
  parseExamTasks,
  splitAnswerBlock,
  stripExamAndFlashcardWrapperLines,
} from "./exam";

describe("parseExamTasks", () => {
  it("strips wrapper lines while keeping markdown headings", () => {
    const markdown = `#exam
#card
# Title
Answer: Secret solution
#endcard
#
#endexam`;

    const stripped = stripExamAndFlashcardWrapperLines(markdown).split("\n");

    expect(stripped).toContain("# Title");
    expect(stripped).not.toContain("#exam");
    expect(stripped).not.toContain("#card");
    expect(stripped).not.toContain("#endcard");
    expect(stripped).not.toContain("#endexam");
    expect(stripped).toContain("#");
  });

  it("splits answer blocks only at line start markers", () => {
    const split = splitAnswerBlock("Answer: Secret solution");
    expect(split.hasAnswerMarker).toBe(true);
    expect(split.prompt).toBe("");
    expect(split.officialAnswer).toBe("Secret solution");

    const boldSplit = splitAnswerBlock("**Answer:** Secret");
    expect(boldSplit.hasAnswerMarker).toBe(true);
    expect(boldSplit.officialAnswer).toBe("Secret");

    const inlineSplit = splitAnswerBlock("This is the answer: maybe");
    expect(inlineSplit.hasAnswerMarker).toBe(false);
    expect(inlineSplit.prompt).toBe("This is the answer: maybe");
  });

  it("ignores #exam markers inside database blocks", () => {
    const markdown = `::::
#exam
1) Hidden task
Answer: hidden
#endexam
::::

#exam
1) Visible task
Answer: visible
#endexam`;

    const { tasks, hasExamBlock } = parseExamTasks(markdown);
    expect(hasExamBlock).toBe(true);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.prompt).toContain("1) Visible task");
    expect(tasks[0]?.prompt).not.toContain("Hidden task");
    expect(tasks[0]?.officialAnswer).toBe("visible");
  });

  it("keeps inline Answer markers as prompt text", () => {
    const markdown = `#exam
1) Define foreign key. Answer: A foreign key is an attribute.
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    const part = task?.card.parts[0];
    expect(part?.kind).toBe("free-text");
    if (part && part.kind === "free-text") {
      expect(part.front).toBe(
        "1) Define foreign key. Answer: A foreign key is an attribute.",
      );
      expect(part.back).toBe("");
    }
    expect(task?.officialAnswer).toBeUndefined();
  });

  it("extracts help blocks without affecting answers", () => {
    const markdown = `#exam
1) Explain HTTP status codes.
#help
-true
Answer: Decoy
#helpend
Answer: Real
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.helpText?.length).toBe(1);
    expect(task?.helpText?.[0]).toContain("Answer: Decoy");
    expect(task?.prompt).toContain("1) Explain HTTP status codes.");
    expect(task?.prompt).not.toContain("Decoy");
    expect(task?.officialAnswer).toBe("Real");
  });

  it("extracts media blocks before answer and choice detection", () => {
    const markdown = `#exam
1) Media task
#card
![[images/cover.png]]
Question one?
Answer: Real
---
![[images/example.png]]
Pick one.
a) First
b) Second
-a
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.prompt).toContain("1) Media task");
    expect(task?.prompt).not.toContain("![[images/cover.png]]");
    expect(task?.prompt).not.toContain("![[images/example.png]]");
    expect(task?.officialAnswer).toBe("Real");
    expect(task?.card.parts).toHaveLength(2);

    const firstPart = task?.card.parts[0];
    const secondPart = task?.card.parts[1];
    expect(firstPart?.kind).toBe("free-text");
    expect(secondPart?.kind).toBe("multiple-choice");
    expect(secondPart?.media).toEqual([
      expect.objectContaining({
        type: "png",
        src: "images/example.png",
      }),
    ]);
    if (secondPart?.kind === "multiple-choice") {
      expect(secondPart.correctKeys).toEqual(["a"]);
    }
  });

  it("keeps inline image embeds as prompt text and does not extract them as media", () => {
    const markdown = `#exam
1) Inline media marker
Question with inline ![[images/inline.png]] marker
Answer: Real
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.prompt).toContain("![[images/inline.png]]");
    expect(task?.media).toBeUndefined();
    expect(task?.card.parts).toHaveLength(1);
    expect(task?.card.parts[0]?.media).toBeUndefined();
  });

  it("attaches help blocks inside #card to the card only", () => {
    const markdown = `#exam
1) Task with help in card.
#card
#help
Answer: Decoy
#helpend
Answer: Real
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.helpText).toBeUndefined();
    expect(task?.card.helpText?.length).toBe(1);
    expect(task?.card.helpText?.[0]).toContain("Answer: Decoy");
    expect(task?.officialAnswer).toBe("Real");
  });

  it("keeps table separators inside a task prompt", () => {
    const markdown = `#exam
1) Table task
| Term | Answer |
| --- | --- |
| Alpha | %one% |
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.prompt).toContain("| --- | --- |");
  });

  it("treats separator lines outside wrappers as task boundaries", () => {
    const markdown = `#exam
1) First task
| Key | Value |
| --- | --- |
| Row | --- |
--- not a separator
Still first task
---
Orphan context that must be ignored
2) Second task
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.prompt).toContain("| Row | --- |");
    expect(tasks[0]?.prompt).toContain("--- not a separator");
    expect(tasks[0]?.prompt).toContain("Still first task");
    expect(tasks[0]?.prompt).not.toContain("Orphan context");
    expect(tasks[1]?.prompt).toContain("2) Second task");
  });

  it("does not split tasks on separator lines inside #card wrappers", () => {
    const markdown = `#exam
1) Wrapped task
#card
Question A?
Answer: A
---
Question B?
Answer: B
#endcard
2) Next task
Answer: C
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.card.parts).toHaveLength(2);
    expect(tasks[1]?.prompt).toContain("2) Next task");
  });

  it("ignores orphan content after separators without a following task header", () => {
    const markdown = `#exam
1) First task
Question?
Answer: A
---
## 3. Orphan heading
Orphan body
---
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.prompt).toContain("1) First task");
    expect(tasks[0]?.prompt).not.toContain("Orphan heading");
    expect(tasks[0]?.prompt).not.toContain("Orphan body");
  });

  it("ignores non-numeric ) sequences as task starts", () => {
    const markdown = `#exam
1) Task one
a) Option A
Text with x) marker
2) Task two
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.prompt).toContain("a) Option A");
    expect(tasks[0]?.prompt).toContain("x) marker");
    expect(tasks[1]?.prompt).toContain("2) Task two");
  });

  it("removes leading dot-number markers from exam task content and headings", () => {
    const markdown = `#exam
1) Task one
#card
## 3. Relationales Modell
3. Aufbau und Struktur
Answer: Loesung
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.prompt).toContain("## Relationales Modell");
    expect(task?.prompt).not.toContain("## 3. Relationales Modell");
    expect(task?.prompt).toContain("Aufbau und Struktur");
    expect(task?.prompt).not.toContain("3. Aufbau und Struktur");
    expect(task?.officialAnswer).toBe("Loesung");
  });

  it("keeps dot-numbered markers inside fenced code blocks unchanged", () => {
    const markdown = `#exam
1) Task one
#card
\`\`\`md
## 3. Titel bleibt
3. Marker bleibt
\`\`\`
3. Marker ausserhalb
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.prompt).toContain("## 3. Titel bleibt");
    expect(task?.prompt).toContain("3. Marker bleibt");
    expect(task?.prompt).toContain("Marker ausserhalb");
    expect(task?.prompt).not.toContain("\n3. Marker ausserhalb");
  });

  it("ignores numeric task headers inside code blocks and tables", () => {
    const markdown = `#exam
1) Task one
\`\`\`
2) Not a task
\`\`\`
| Col | Value |
| --- | --- |
| Row | 3) Not a task |
2) Task two
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.prompt).toContain("2) Not a task");
    expect(tasks[0]?.prompt).toContain("| Row | 3) Not a task |");
    expect(tasks[1]?.prompt).toContain("2) Task two");
  });

  it("keeps card/exam tags inside table cells", () => {
    const markdown = `#exam
1) Table tags
| Type | Tag |
| --- | --- |
| Alpha | #exam |
| Beta | #card |
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.prompt).toContain("| Alpha | #exam |");
    expect(tasks[0]?.prompt).toContain("| Beta | #card |");
  });

  it("adds a free-text part for answer blocks alongside multiple choice", () => {
    const markdown = `#exam
  #card
  1) Question line
a) First
b) Second
-a
Answer: Secret solution
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.prompt).toContain("1) Question line");
    expect(task?.prompt).toContain("a) First");
    expect(task?.prompt).not.toContain("Answer:");
    expect(task?.prompt).not.toContain("#card");
    expect(task?.officialAnswer).toBe("Secret solution");

    const parts = task?.card.parts ?? [];
    expect(parts.some((part) => part.kind === "multiple-choice")).toBe(true);
    const answerPart = parts.find((part) => part.kind === "free-text");
    expect(answerPart).toBeTruthy();
    if (answerPart && answerPart.kind === "free-text") {
      expect(answerPart.front).toBe("");
      expect(answerPart.back).toBe("Secret solution");
    }
  });

  it("detects wrapper when #card is directly before task start and closes with #endcard", () => {
    const markdown = `#exam
#card
1) Wrapped before start
Question?
Answer: A
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.cardWrapper).toBe(true);
    expect(tasks[0]?.rawLines[0]?.trim()).toBe("#card");
  });

  it("does not detect wrapper when a bare '#' is used as a legacy close", () => {
    const markdown = `#exam
#card
1) Legacy close
Question?
Answer: A
#
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.cardWrapper).toBe(false);
  });

  it("does not mark wrapper as canonical when #card starts inside the task", () => {
    const markdown = `#exam
1) Wrapped inside
#card
Question?
Answer: A
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.cardWrapper).toBe(false);
  });

  it("does not mark wrapper as full when closing #endcard is missing", () => {
    const markdown = `#exam
1) Missing close
#card
Question?
Answer: A
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.cardWrapper).toBe(false);
  });

  it("does not mark wrapper as full when content exists after closing #endcard", () => {
    const markdown = `#exam
1) Trailing content
#card
Question?
Answer: A
#endcard
Still task content
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.cardWrapper).toBe(false);
  });

  it("does not treat markdown headings as card closing markers", () => {
    const markdown = `#exam
1) Heading line
#card
Question?
Answer: A
# Title
#endexam`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.cardWrapper).toBe(false);
  });
});

describe("exam QA composite parsing", () => {
  const qaAnswer = "Minimal rights for users";
  const qaAnswerSecond = "Extended rights for admins";
  const qaBlock = `[qa]
What is least privilege?
Antwort: ${qaAnswer}`;
  const qaBlockSecond = `[qa]
Why is least privilege important?
Antwort: ${qaAnswerSecond}`;
  const tfBlock = `[tf]
Aussage:
HTTPS encrypts the connection.
-true`;
  const m1Block = `[m1]
Which number is a prime?
a) 4
b) 5
c) 9
-b`;
  const m2Block = `[m2]
Which numbers are primes?
a) 2
b) 4
c) 5
d) 9
-a
-c`;
  const clBlock = `[cl]
The capital of France is %Paris%.`;
  const cdBlock = `[cd]
Colors: "schwarz", "rot", "gold".`;
  const cldBlock = `[cld]
[cl] The capital of France is %Paris%.
[cd] Colors: "schwarz", "rot", "gold".`;

  const buildCardBody = (...sections: string[]) => sections.join("\n\n");
  const buildExamMarkdown = (title: string, body: string, index = 1) => `#exam
${index}) ${title}
#card
${body}
#endcard
#endexam
`;
  const parseTask = (title: string, body: string) => {
    const { tasks } = parseExamTasks(buildExamMarkdown(title, body));
    expect(tasks).toHaveLength(1);
    return tasks[0];
  };

  it("parses qa + qa combinations without swallowing the second part", () => {
    const task = parseTask("qa + qa", buildCardBody(qaBlock, qaBlockSecond));
    const parts = task.card.parts;
    expect(parts.map((part) => part.kind)).toEqual(["free-text", "free-text"]);
    expect(task.officialAnswer).toBe(`${qaAnswer}\n\n${qaAnswerSecond}`);
  });

  it("parses qa + tf combinations", () => {
    const task = parseTask("qa + tf", buildCardBody(qaBlock, tfBlock));
    const parts = task.card.parts;
    expect(parts.map((part) => part.kind)).toEqual(["free-text", "true-false"]);
    expect(task.officialAnswer).toBe(qaAnswer);
  });

  it("parses qa + m1 combinations", () => {
    const task = parseTask("qa + m1", buildCardBody(qaBlock, m1Block));
    const parts = task.card.parts;
    expect(parts.map((part) => part.kind)).toEqual(["free-text", "multiple-choice"]);
    expect(task.officialAnswer).toBe(qaAnswer);
  });

  it("parses qa + m2 combinations", () => {
    const task = parseTask("qa + m2", buildCardBody(qaBlock, m2Block));
    const parts = task.card.parts;
    expect(parts.map((part) => part.kind)).toEqual(["free-text", "multiple-choice"]);
    expect(task.officialAnswer).toBe(qaAnswer);
  });

  it("parses qa + cl combinations", () => {
    const task = parseTask("qa + cl", buildCardBody(qaBlock, clBlock));
    const parts = task.card.parts;
    expect(parts.map((part) => part.kind)).toEqual(["free-text", "cloze"]);
    expect(task.officialAnswer).toBe(qaAnswer);
  });

  it("parses qa + cd combinations", () => {
    const task = parseTask("qa + cd", buildCardBody(qaBlock, cdBlock));
    const parts = task.card.parts;
    expect(parts.map((part) => part.kind)).toEqual(["free-text", "cloze"]);
    expect(task.officialAnswer).toBe(qaAnswer);
  });

  it("parses qa + cld combinations", () => {
    const task = parseTask("qa + cld", buildCardBody(qaBlock, cldBlock));
    const parts = task.card.parts;
    expect(parts.map((part) => part.kind)).toEqual(["free-text", "cloze"]);
    expect(task.officialAnswer).toBe(qaAnswer);
  });

  it("still parses single qa tasks in exam mode", () => {
    const task = parseTask("qa only", qaBlock);
    const parts = task.card.parts;
    expect(parts).toHaveLength(1);
    expect(parts[0].kind).toBe("free-text");
    expect(task.officialAnswer).toBe(qaAnswer);
  });
});

describe("exam parser container rules", () => {
  it("treats '#' lines as plain text and closes only at '#endexam'", () => {
    const markdown = `#exam
1) First question
#
## Section title
Answer: Keep it internal
#
#endexam`;

    const { tasks, hasExamBlock } = parseExamTasks(markdown);
    expect(hasExamBlock).toBe(true);
    expect(tasks).toHaveLength(1);
  });

  it("ends the exam only when '#endexam' is seen after '#'", () => {
    const markdown = `#exam
1) Alpha
#
2) Beta
#endexam`;
    const { tasks } = parseExamTasks(markdown);
    expect(tasks).toHaveLength(2);
  });

  it("ignores '#card' markers inside an exam block", () => {
    const markdown = `#exam
#card
1) Nested card text
Answer: Plain text remains
#endcard
#endexam`;

    const { tasks } = parseExamTasks(markdown);
    expect(tasks).toHaveLength(1);
  });

  it("recognizes exam markers case-insensitively", () => {
    const markdown = `#ExAm
1) Alpha
Answer: A
#eNdExAm`;
    const { tasks, hasExamBlock } = parseExamTasks(markdown);
    expect(hasExamBlock).toBe(true);
    expect(tasks).toHaveLength(1);
  });

  it("requires both #exam and #endexam for hasExamBlock", () => {
    const markdown = `#exam
1) Missing end marker
Answer: A`;
    const { hasExamBlock } = parseExamTasks(markdown);
    expect(hasExamBlock).toBe(false);
  });
});
