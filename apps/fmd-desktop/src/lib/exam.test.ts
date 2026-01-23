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
#
#
#examend`;

    const stripped = stripExamAndFlashcardWrapperLines(markdown).split("\n");

    expect(stripped).toContain("# Title");
    expect(stripped).not.toContain("#exam");
    expect(stripped).not.toContain("#card");
    expect(stripped).not.toContain("#endcard");
    expect(stripped).not.toContain("#examend");
    expect(stripped).not.toContain("#");
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

  it("keeps inline Answer markers as prompt text", () => {
    const markdown = `#exam
1) Define foreign key. Answer: A foreign key is an attribute.
#
#examend`;

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
#
#examend`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task?.helpText?.length).toBe(1);
    expect(task?.helpText?.[0]).toContain("Answer: Decoy");
    expect(task?.prompt).toContain("1) Explain HTTP status codes.");
    expect(task?.prompt).not.toContain("Decoy");
    expect(task?.officialAnswer).toBe("Real");
  });

  it("attaches help blocks inside #card to the card only", () => {
    const markdown = `#exam
1) Task with help in card.
#card
#help
Answer: Decoy
#helpend
Answer: Real
#
#examend`;

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
| Alpha | %%one%% |
#
#examend`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.prompt).toContain("| --- | --- |");
  });

  it("does not split tasks on separator lines", () => {
    const markdown = `#exam
1) First task
| Key | Value |
| --- | --- |
| Row | --- |
--- not a separator
Still first task
---
2) Second task
#
#examend`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.prompt).toContain("| Row | --- |");
    expect(tasks[0]?.prompt).toContain("--- not a separator");
    expect(tasks[0]?.prompt).not.toContain("\n---\n");
    expect(tasks[0]?.prompt).toContain("Still first task");
    expect(tasks[1]?.prompt).toContain("2) Second task");
  });

  it("keeps card/exam tags inside table cells", () => {
    const markdown = `#exam
1) Table tags
| Type | Tag |
| --- | --- |
| Alpha | #exam |
| Beta | #card |
#
#examend`;

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
#
#examend`;

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
The capital of France is %%Paris%%.`;
  const cdBlock = `[cd]
Colors: tocken "schwarz", tocken "rot", tocken "gold".`;
  const cldBlock = `[cld]
[cl] The capital of France is %%Paris%%.
[cd] Colors: tocken "schwarz", tocken "rot", tocken "gold".`;

  const buildCardBody = (...sections: string[]) => sections.join("\n\n");
  const buildExamMarkdown = (title: string, body: string, index = 1) => `#exam
${index}) ${title}
#card
${body}
#
#examend
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
  it("treats '#' lines as plain text and closes only at '#examend'", () => {
    const markdown = `#exam
1) First question
#
## Section title
Answer: Keep it internal
#
#examend`;

    const { tasks, hasExamBlock } = parseExamTasks(markdown);
    expect(hasExamBlock).toBe(true);
    expect(tasks).toHaveLength(1);
  });

  it("ends the exam only when '#examend' is seen after '#'", () => {
    const markdown = `#exam
1) Alpha
#
2) Beta
#examend`;
    const { tasks } = parseExamTasks(markdown);
    expect(tasks).toHaveLength(2);
  });

  it("ignores '#card' markers inside an exam block", () => {
    const markdown = `#exam
#card
1) Nested card text
Answer: Plain text remains
#
#examend`;

    const { tasks } = parseExamTasks(markdown);
    expect(tasks).toHaveLength(1);
  });
});
