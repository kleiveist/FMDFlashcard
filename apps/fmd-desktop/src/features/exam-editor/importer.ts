/**
 * @file apps/fmd-desktop/src/features/exam-editor/importer.ts
 *
 * Zweck:
 * - Importiert Exam-Markdown in Exam-Editor Blueprints.
 */

import { parseExamTasks, splitAnswerBlock } from "../../lib/exam";
import { falseTokens, trueTokens } from "../../lib/flashcardKeywords";
import type {
  ClozeSegment,
  FlashcardPart,
  MultipleChoiceCard,
  TrueFalseCard,
} from "../../lib/flashcards";
import { hasClozeMarker, parseFlashcards, splitAnswerCard } from "../../lib/flashcards";
import { findTableLineIndices } from "../../lib/markdownTables";
import { createBlueprintId, createExamBlueprint } from "./blueprint";
import type {
  CardBlueprint,
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

const stripLeadingTaskNumberLine = (lines: string[]) => {
  const next = lines.slice();
  let expectedNumber: string | null = null;
  let index = 0;

  while (index < next.length) {
    const line = next[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const match = line.match(taskLinePattern);
    if (!match) {
      break;
    }
    const number = match[1] ?? "";
    if (!expectedNumber) {
      expectedNumber = number;
    } else if (number !== expectedNumber) {
      break;
    }
    const remainder = match[2] ?? "";
    if (remainder.trim() === "") {
      next.splice(index, 1);
      continue;
    }
    next[index] = remainder;
    index += 1;
  }
  return next;
};

const stripLeadingTaskNumber = (text: string) =>
  stripLeadingTaskNumberLine(text.replace(/\r\n?/g, "\n").split("\n")).join("\n");

const helpStartPattern = /^\s*#help\s*$/;
const helpEndPattern = /^\s*#helpend\s*$/;
const separatorLinePattern = /^\s*---\s*$/;
const fencePattern = /^\s*(```|~~~)/;
const cardStartPattern = /^\s*#card\s*$/i;
const cardEndPattern = /^\s*#(?:endcard)?\s*$/i;
const optionPattern = /^([A-Za-z])\)\s*(.*)$/;
const markerPattern = /^-([A-Za-z])$/;
const taskLinePattern = /^(?:-\s*)?(?:\*\*)?(\d+)\)?\s*(?:\*\*)?\s*(.*)$/;

const isHelpStartLine = (line: string) => helpStartPattern.test(line);
const isHelpEndLine = (line: string) => helpEndPattern.test(line);
const isSeparatorLine = (line: string) => separatorLinePattern.test(line);
const isCardBoundaryLine = (line: string) =>
  cardStartPattern.test(line) || cardEndPattern.test(line);
const isOptionLine = (line: string) => optionPattern.test(line.trim());
const isCorrectMarkerLine = (line: string) => markerPattern.test(line.trim());
const isAnswerMarkerLine = (line: string) =>
  Boolean(splitAnswerCard([line], { answerMatch: "line-start" }));

const normalizeKeyword = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizedTrueTokens = new Set(trueTokens.map(normalizeKeyword));
const normalizedFalseTokens = new Set(falseTokens.map(normalizeKeyword));

const normalizeTrueFalseMarker = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("-")) {
    return null;
  }
  const rawToken = trimmed.slice(1).trim();
  if (!rawToken) {
    return null;
  }
  const cleaned = rawToken.replace(/[.,;:!?]+$/g, "");
  const normalized = normalizeKeyword(cleaned);
  if (normalizedTrueTokens.has(normalized)) {
    return "true";
  }
  if (normalizedFalseTokens.has(normalized)) {
    return "false";
  }
  return null;
};

const isTrueFalseMarkerLine = (line: string) =>
  normalizeTrueFalseMarker(line) !== null;

const collectDescriptionLines = (lines: string[]) => {
  const tableLineIndices = findTableLineIndices(lines);
  const output: string[] = [];
  let inFence = false;
  let fenceToken = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = line.trimStart().match(fencePattern);
    if (fenceMatch) {
      if (inFence && fenceMatch[1] === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[1] ?? "";
      }
      output.push(line);
      continue;
    }

    if (inFence || tableLineIndices.has(index)) {
      output.push(line);
      continue;
    }

    if (
      isCardBoundaryLine(line) ||
      isAnswerMarkerLine(line) ||
      isTrueFalseMarkerLine(line) ||
      isOptionLine(line) ||
      isCorrectMarkerLine(line) ||
      hasClozeMarker(line)
    ) {
      break;
    }

    output.push(line);
  }

  return trimEmptyLines(output);
};

const extractHeadingParagraph = (lines: string[]) => {
  const startIndex = lines.findIndex((line) => line.trim() !== "");
  if (startIndex === -1) {
    return "";
  }
  let endIndex = startIndex;
  while (endIndex < lines.length && lines[endIndex]?.trim() !== "") {
    endIndex += 1;
  }
  return lines.slice(startIndex, endIndex).join("\n").trim();
};

const stripTaskNumberFromLines = (lines: string[]) => {
  const index = lines.findIndex((line) => line.trim() !== "");
  if (index === -1) {
    return lines;
  }
  const match = lines[index]?.trim().match(taskLinePattern);
  if (!match) {
    return lines;
  }
  return lines.slice(index + 1);
};

type TaskHeadingInfo = {
  heading: string;
  removeHeadingFromPrompt: boolean;
  headingLineCount: number;
};

const extractTaskNumberInfo = (lines: string[]) => {
  const index = lines.findIndex((line) => line.trim() !== "");
  if (index === -1) {
    return null;
  }
  const match = lines[index]?.trim().match(taskLinePattern);
  if (!match) {
    return null;
  }
  return {
    number: match[1] ?? "",
    text: (match[2] ?? "").trim(),
  };
};

const resolveHeadingParagraph = (lines: string[]) => {
  const tableLineIndices = findTableLineIndices(lines);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      return {
        continuationLines: lines.slice(0, index),
        descriptionStartIndex: index + 1,
      };
    }
    if (line.trimStart().match(fencePattern)) {
      return {
        continuationLines: lines.slice(0, index),
        descriptionStartIndex: index,
      };
    }
    if (tableLineIndices.has(index)) {
      return {
        continuationLines: lines.slice(0, index),
        descriptionStartIndex: index,
      };
    }
    if (
      isCardBoundaryLine(line) ||
      isAnswerMarkerLine(line) ||
      isTrueFalseMarkerLine(line) ||
      isOptionLine(line) ||
      isCorrectMarkerLine(line) ||
      hasClozeMarker(line)
    ) {
      return {
        continuationLines: lines.slice(0, index),
        descriptionStartIndex: lines.length,
      };
    }
  }
  return {
    continuationLines: lines.slice(),
    descriptionStartIndex: lines.length,
  };
};

const deriveTaskHeadingInfo = (
  rawLines: string[],
  firstBlockLines: string[],
  taskIndex: number,
  hasCardWrapper: boolean,
): TaskHeadingInfo => {
  const numberInfo = extractTaskNumberInfo(rawLines);
  const numberText = numberInfo?.text ?? "";
  const numberLineHasText = Boolean(numberText);
  let descriptionSource = hasCardWrapper
    ? firstBlockLines
    : stripTaskNumberFromLines(firstBlockLines);
  let heading = numberText;
  let headingLineCount = 0;

  if (numberLineHasText && !hasCardWrapper) {
    const { continuationLines, descriptionStartIndex } =
      resolveHeadingParagraph(descriptionSource);
    headingLineCount = 1 + continuationLines.length;
    heading = [numberText, ...continuationLines].join("\n").trim();
    descriptionSource =
      descriptionStartIndex < descriptionSource.length
        ? descriptionSource.slice(descriptionStartIndex)
        : [];
  }

  const descriptionLines = collectDescriptionLines(descriptionSource);

  if (!heading) {
    heading = extractHeadingParagraph(descriptionLines);
  }
  if (!heading) {
    const fallbackNumber = numberInfo?.number || String(taskIndex + 1);
    heading = `Task ${fallbackNumber}`;
  }

  return {
    heading,
    headingLineCount,
    removeHeadingFromPrompt:
      !hasCardWrapper && numberLineHasText && descriptionLines.length > 0,
  };
};

const serializeClozeSegments = (segments: ClozeSegment[]) => {
  let output = "";
  segments.forEach((segment) => {
    if (segment.type === "text") {
      output += segment.value;
      return;
    }
    if (segment.kind === "input") {
      output += `%${segment.solution}%`;
      return;
    }
    const escaped = segment.solution.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    output += `"${escaped}"`;
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

const resolveChoiceType = (card: MultipleChoiceCard): "m1" | "m2" =>
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
      void _exhaustive;
      return [];
    }
  }
};

type CardBlock = {
  contentLines: string[];
  helpText?: string;
};

const splitCardBlocksWithHelp = (lines: string[]): CardBlock[] => {
  const blocks: CardBlock[] = [];
  const tableLineIndices = findTableLineIndices(lines);
  let currentLines: string[] = [];
  let helpBlocks: string[] = [];
  let inHelp = false;
  let currentHelp: string[] = [];
  let inFence = false;
  let fenceToken = "";

  const flushHelp = () => {
    const trimmed = trimEmptyLines(currentHelp);
    if (trimmed.length > 0) {
      helpBlocks.push(trimmed.join("\n"));
    }
    currentHelp = [];
  };

  const flushBlock = () => {
    const trimmed = trimEmptyLines(currentLines);
    const helpText = joinHelpBlocks(helpBlocks);
    if (trimmed.length > 0 || helpText) {
      blocks.push({ contentLines: trimmed, helpText });
    }
    currentLines = [];
    helpBlocks = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(fencePattern);
    if (fenceMatch) {
      if (inFence && fenceMatch[1] === fenceToken) {
        inFence = false;
        fenceToken = "";
      } else if (!inFence) {
        inFence = true;
        fenceToken = fenceMatch[1] ?? "";
      }
      if (inHelp) {
        currentHelp.push(line);
      } else {
        currentLines.push(line);
      }
      return;
    }

    if (inHelp) {
      if (!inFence && isHelpEndLine(line)) {
        inHelp = false;
        flushHelp();
        return;
      }
      currentHelp.push(line);
      return;
    }
    if (!inFence && isHelpStartLine(line)) {
      inHelp = true;
      currentHelp = [];
      return;
    }
    if (!inFence && isSeparatorLine(line) && !tableLineIndices.has(index)) {
      flushBlock();
      return;
    }
    currentLines.push(line);
  });

  if (inHelp) {
    flushHelp();
  }
  flushBlock();

  return blocks;
};

const parseCardBlock = (lines: string[]): FlashcardPart[] => {
  const trimmed = trimEmptyLines(lines);
  if (trimmed.length === 0) {
    return [];
  }
  const cardSource = ["#card", ...trimmed, "#"].join("\n");
  const parsed = parseFlashcards(cardSource, { answerMatch: "line-start" });
  if (parsed.length === 0 || parsed[0].kind !== "composite") {
    return [];
  }
  return parsed[0].parts;
};

const extractExamMeta = (markdown: string, taskStartLine: number | null) => {
  const lines = normalizeLines(markdown);
  const examStartIndex = lines.findIndex((line) => /^\s*#exam\s*$/i.test(line));
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
    const cards: CardBlueprint[] = [];
    const cardBlocks = splitCardBlocksWithHelp(task.cardLines);
    const headingInfo = deriveTaskHeadingInfo(
      task.rawLines,
      cardBlocks[0]?.contentLines ?? [],
      index,
      task.cardWrapper,
    );
    const hasCardContent = cardBlocks.some(
      (block) => trimEmptyLines(block.contentLines).length > 0,
    );
    cardBlocks.forEach((block, blockIndex) => {
      let trimmedLines = stripLeadingTaskNumberLine(
        trimEmptyLines(block.contentLines),
      );
      if (
        blockIndex === 0 &&
        headingInfo.removeHeadingFromPrompt &&
        trimmedLines.length > 0
      ) {
        const dropCount = Math.min(
          headingInfo.headingLineCount || 1,
          trimmedLines.length,
        );
        trimmedLines = trimmedLines.slice(dropCount);
      }
      if (trimmedLines.length === 0) {
        return;
      }
      const parts = parseCardBlock(trimmedLines);
      if (parts.length === 0) {
        const fallback = splitAnswerBlock(trimmedLines.join("\n"));
        // Only treat unrecognized blocks as QA when an explicit answer marker exists.
        if (!fallback.hasAnswerMarker) {
          return;
        }
        const fallbackCard: CardBlueprint = {
          id: createBlueprintId("card"),
          type: "qa",
          prompt: fallback.prompt,
          answer: fallback.officialAnswer ?? "",
          helpText: block.helpText,
        };
        cards.push(fallbackCard);
        return;
      }
      let appliedHelp = false;
      parts.forEach((part) => {
        const partCards = buildCardsFromPart(part);
        if (part.kind === "true-false" && part.items.length > 1) {
          warnings.push("Multiple true/false statements were split into separate cards.");
        }
        if (!appliedHelp && block.helpText && partCards.length > 0) {
          partCards[0].helpText = block.helpText;
          appliedHelp = true;
        }
        cards.push(...partCards);
      });
    });

    if (cards.length === 0) {
      if (task.officialAnswer !== undefined) {
        cards.push({
          id: createBlueprintId("card"),
          type: "qa",
          prompt: stripLeadingTaskNumber(task.prompt),
          answer: task.officialAnswer ?? "",
        });
      } else if (!hasCardContent) {
        cards.push({
          id: createBlueprintId("card"),
          type: "qa",
          prompt: headingInfo.heading,
          answer: "",
        });
      }
    }

    const taskBlueprint: ExamTaskBlueprint = {
      id: createBlueprintId("task"),
      order: index,
      title: headingInfo.heading,
      helpText: joinHelpBlocks(task.helpText),
      useCardWrapper: task.cardWrapper,
      cards,
    };

    return taskBlueprint;
  });

  return { blueprint, warnings };
};
