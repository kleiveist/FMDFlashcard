/**
 * @file apps/fmd-desktop/src/features/exam-editor/importer.ts
 *
 * Zweck:
 * - Importiert Exam-Markdown in Exam-Editor Blueprints.
 */

import { parseExamTasks } from "../../lib/exam";
import type {
  ClozeSegment,
  FlashcardPart,
  MultipleChoiceCard,
  TrueFalseCard,
} from "../../lib/flashcards";
import { createBlueprintId, createExamBlueprint } from "./blueprint";
import type {
  CardBlueprint,
  CardType,
  ExamBlueprint,
  ExamTaskBlueprint,
  ChoiceOption,
} from "./types";

export type ExamImportResult = {
  blueprint: ExamBlueprint;
  warnings: string[];
};

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

const joinHelpBlocks = (blocks?: string[]) => {
  if (!blocks || blocks.length === 0) {
    return undefined;
  }
  const trimmed = blocks.map((block) => block.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.join("\n\n");
};

const hasClozeMarker = (line: string) => line.includes("%%") || line.includes("`");

const serializeClozeSegments = (segments: ClozeSegment[]) => {
  let output = "";
  segments.forEach((segment) => {
    if (segment.type === "text") {
      output += segment.value;
      return;
    }
    if (segment.kind === "input") {
      output += `%%${segment.solution}%%`;
      return;
    }
    output += `\`${segment.solution}\``;
  });
  return output;
};

const buildChoiceOptions = (
  card: MultipleChoiceCard,
): ChoiceOption[] => {
  const correctSet = new Set(card.correctKeys);
  return card.options.map((option) => ({
    id: createBlueprintId("option"),
    text: option.text,
    isCorrect: correctSet.has(option.key.toLowerCase()),
  }));
};

const resolveChoiceType = (card: MultipleChoiceCard): CardType =>
  card.correctKeys.length > 1 ? "m2" : "m1";

const buildPromptWithContext = (question: string, context?: string) => {
  if (!context || !context.trim()) {
    return question;
  }
  return `${question}\n${context}`.trim();
};

const buildCardFromFreeText = (
  part: Extract<FlashcardPart, { kind: "free-text" }>,
): CardBlueprint => ({
  id: createBlueprintId("card"),
  type: "qa",
  prompt: part.front,
  answer: part.back,
});

const buildCardsFromTrueFalse = (part: TrueFalseCard): CardBlueprint[] =>
  part.items.map((item) => ({
    id: createBlueprintId("card"),
    type: "tf",
    prompt: item.question,
    correct: item.correct === "falsch" ? "false" : "true",
  }));

const buildCardFromMultipleChoice = (part: MultipleChoiceCard): CardBlueprint => ({
  id: createBlueprintId("card"),
  type: resolveChoiceType(part),
  prompt: buildPromptWithContext(part.question, part.context),
  options: buildChoiceOptions(part),
});

const buildCardFromCloze = (
  part: Extract<FlashcardPart, { kind: "cloze" }>,
): CardBlueprint => {
  const clozeText = serializeClozeSegments(part.segments);
  const question = part.question.trim();
  const prompt = !question
    ? clozeText
    : hasClozeMarker(question)
      ? clozeText
      : clozeText && clozeText.trim() !== question
        ? `${question}\n${clozeText}`
        : question;

  return {
    id: createBlueprintId("card"),
    type: part.subtype,
    prompt,
  };
};

const buildCardsFromPart = (part: FlashcardPart): CardBlueprint[] => {
  switch (part.kind) {
    case "free-text":
      return [buildCardFromFreeText(part)];
    case "true-false":
      return buildCardsFromTrueFalse(part);
    case "multiple-choice":
      return [buildCardFromMultipleChoice(part)];
    case "cloze":
      return [buildCardFromCloze(part)];
    default: {
      const _exhaustive: never = part;
      return [];
    }
  }
};

const extractTaskTitle = (lines: string[]) => {
  const taskLine = lines.find((line) => line.trim() !== "") ?? "";
  const trimmed = taskLine.trim();
  const match = trimmed.match(/^(?:-\s*)?(?:\*\*)?(\d+)\)?\s*(?:\*\*)?\s*(.*)$/);
  if (!match) {
    return "";
  }
  return (match[2] ?? "").trim();
};

const extractExamMeta = (markdown: string, taskStartLine: number | null) => {
  const lines = normalizeLines(markdown);
  const examStartIndex = lines.findIndex((line) => /^\s*#exam\s*$/.test(line));
  if (examStartIndex === -1) {
    return { title: "", description: "" };
  }
  const endIndex = taskStartLine ?? lines.length;
  const metaLines = trimEmptyLines(lines.slice(examStartIndex + 1, endIndex));
  if (metaLines.length === 0) {
    return { title: "", description: "" };
  }
  const headingMatch = metaLines[0]?.match(/^\s*#{1,6}\s+(.*)$/);
  if (headingMatch) {
    return {
      title: (headingMatch[1] ?? "").trim(),
      description: metaLines.slice(1).join("\n").trim(),
    };
  }
  return {
    title: "",
    description: metaLines.join("\n").trim(),
  };
};

export const isExamMarkdown = (markdown: string) =>
  parseExamTasks(markdown).hasExamBlock;

export const importExamMarkdown = (markdown: string): ExamImportResult | null => {
  const parsed = parseExamTasks(markdown);
  if (!parsed.hasExamBlock) {
    return null;
  }

  const warnings: string[] = [];
  const firstTaskLine = parsed.tasks
    .map((task) => task.sourceRange.startLine)
    .sort((a, b) => a - b)[0];
  const meta = extractExamMeta(markdown, Number.isFinite(firstTaskLine) ? firstTaskLine : null);

  const blueprint: ExamBlueprint = {
    ...createExamBlueprint(),
    title: meta.title,
    description: meta.description,
    tasks: [],
  };

  blueprint.tasks = parsed.tasks.map((task, index) => {
    const taskTitle = extractTaskTitle(task.rawLines);
    const cards: CardBlueprint[] = [];
    const cardHelp = joinHelpBlocks(task.card.helpText);
    let appliedHelp = false;

    task.card.parts.forEach((part) => {
      const partCards = buildCardsFromPart(part);
      if (part.kind === "true-false" && part.items.length > 1) {
        warnings.push("Multiple true/false statements were split into separate cards.");
      }
      if (!appliedHelp && cardHelp && partCards.length > 0) {
        partCards[0].helpText = cardHelp;
        appliedHelp = true;
      }
      cards.push(...partCards);
    });

    if (cards.length === 0) {
      cards.push({
        id: createBlueprintId("card"),
        type: "qa",
        prompt: task.prompt,
        answer: task.officialAnswer ?? "",
      });
    }

    const taskBlueprint: ExamTaskBlueprint = {
      id: createBlueprintId("task"),
      order: index,
      title: taskTitle,
      helpText: joinHelpBlocks(task.helpText),
      cards,
    };

    return taskBlueprint;
  });

  return { blueprint, warnings };
};
