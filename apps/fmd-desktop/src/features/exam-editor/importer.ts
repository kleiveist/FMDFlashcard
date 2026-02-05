/**
 * @file apps/fmd-desktop/src/features/exam-editor/importer.ts
 *
 * Zweck:
 * - Importiert Exam-Markdown in Exam-Editor Blueprints.
 */

import { parseExamTasks, splitAnswerBlock } from "../../lib/exam";
import type {
  ClozeSegment,
  FlashcardPart,
  MultipleChoiceCard,
  TrueFalseCard,
} from "../../lib/flashcards";
import { hasClozeMarker, parseFlashcards } from "../../lib/flashcards";
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

const helpStartPattern = /^\s*#help\s*$/;
const helpEndPattern = /^\s*#helpend\s*$/;
const separatorLinePattern = /^\s*---\s*$/;
const fencePattern = /^\s*(```|~~~)/;
const cardStartPattern = /^\s*#card\s*$/i;
const cardEndPattern = /^\s*#(?:endcard)?\s*$/i;
const taskLinePattern = /^\s*(\d+)\)\s*(.*)$/;

const isHelpStartLine = (line: string) => helpStartPattern.test(line);
const isHelpEndLine = (line: string) => helpEndPattern.test(line);
const isSeparatorLine = (line: string) => separatorLinePattern.test(line);
const isCardBoundaryLine = (line: string) =>
  cardStartPattern.test(line) || cardEndPattern.test(line);

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

const findTaskHeaderIndex = (lines: string[]) =>
  lines.findIndex(
    (line) => line.trim() !== "" && taskLinePattern.test(line.trim()),
  );

const isHelpDirectlyAfterHeader = (
  lines: string[],
  headerIndex: number,
  helpStartIndex: number,
) => {
  if (headerIndex < 0 || helpStartIndex <= headerIndex) {
    return false;
  }
  for (let index = headerIndex + 1; index < helpStartIndex; index += 1) {
    if (lines[index]?.trim() !== "") {
      return false;
    }
  }
  return true;
};

const resolveTaskHelpBlock = (
  lines: string[],
  helpBlocks: HelpBlockInfo[],
): HelpBlockInfo | null => {
  if (helpBlocks.length === 0) {
    return null;
  }
  const headerIndex = findTaskHeaderIndex(lines);
  const primary = helpBlocks.find(
    (block) =>
      !block.inCard &&
      isHelpDirectlyAfterHeader(lines, headerIndex, block.startIndex),
  );

  const helpLineIndices = new Set<number>();
  helpBlocks.forEach((block) => {
    for (let index = block.startIndex; index <= block.endIndex; index += 1) {
      helpLineIndices.add(index);
    }
  });

  let lastContentIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      continue;
    }
    if (helpLineIndices.has(index)) {
      continue;
    }
    if (isCardBoundaryLine(line) || isSeparatorLine(line)) {
      continue;
    }
    lastContentIndex = index;
    break;
  }

  let secondary: HelpBlockInfo | null = null;
  for (let index = helpBlocks.length - 1; index >= 0; index -= 1) {
    const block = helpBlocks[index];
    if (block.inCard) {
      continue;
    }
    if (lastContentIndex === -1 || block.endIndex >= lastContentIndex) {
      secondary = block;
      break;
    }
  }

  if (!primary) {
    return secondary;
  }
  if (!secondary || primary === secondary) {
    return primary;
  }

  const tableLineIndices = findTableLineIndices(lines);
  const lineBlockIndex: number[] = Array(lines.length).fill(-1);
  const blockHasContent: boolean[] = [];
  let inFence = false;
  let fenceToken = "";
  let blockIndex = 0;

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
      lineBlockIndex[index] = blockIndex;
      if (!helpLineIndices.has(index) && line.trim() !== "") {
        blockHasContent[blockIndex] = true;
      }
      return;
    }

    if (!inFence && isSeparatorLine(line) && !tableLineIndices.has(index)) {
      lineBlockIndex[index] = -1;
      blockIndex += 1;
      return;
    }

    lineBlockIndex[index] = blockIndex;
    if (!helpLineIndices.has(index) && line.trim() !== "") {
      blockHasContent[blockIndex] = true;
    }
  });

  const blockToCardIndex = new Map<number, number>();
  let cardIndex = 0;
  for (let index = 0; index <= blockIndex; index += 1) {
    if (blockHasContent[index]) {
      blockToCardIndex.set(index, cardIndex);
      cardIndex += 1;
    }
  }

  const scoreAlignment = (candidate: HelpBlockInfo) => {
    const remaining = helpBlocks.filter((block) => block !== candidate);
    let score = 0;
    remaining.forEach((block, index) => {
      const blockIndexForLine = lineBlockIndex[block.startIndex] ?? -1;
      const mappedCardIndex = blockToCardIndex.get(blockIndexForLine);
      if (mappedCardIndex === index) {
        score += 1;
      }
    });
    return score;
  };

  const primaryScore = scoreAlignment(primary);
  const secondaryScore = scoreAlignment(secondary);
  if (secondaryScore > primaryScore) {
    return secondary;
  }
  return primary;
};

const deriveTaskHeadingInfo = (
  rawLines: string[],
  hasCardWrapper: boolean,
): TaskHeadingInfo => {
  const numberInfo = extractTaskNumberInfo(rawLines);
  const heading = (numberInfo?.text ?? "").trim();
  const numberLineHasText = Boolean(heading);
  return {
    heading,
    headingLineCount: numberLineHasText ? 1 : 0,
    removeHeadingFromPrompt: !hasCardWrapper && numberLineHasText,
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
};

type HelpBlockInfo = {
  startIndex: number;
  endIndex: number;
  text: string;
  inCard: boolean;
};

const collectHelpBlocks = (lines: string[]): HelpBlockInfo[] => {
  const blocks: HelpBlockInfo[] = [];
  let inHelp = false;
  let inFence = false;
  let fenceToken = "";
  let inCard = false;
  let blockStart = -1;
  let blockInCard = false;
  let currentLines: string[] = [];

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
    }

    if (!inFence && !inHelp) {
      if (cardStartPattern.test(line)) {
        inCard = true;
        return;
      }
      if (cardEndPattern.test(line)) {
        inCard = false;
        return;
      }
    }

    if (inHelp) {
      if (!inFence && isHelpEndLine(line)) {
        blocks.push({
          startIndex: blockStart,
          endIndex: index,
          text: trimEmptyLines(currentLines).join("\n").trim(),
          inCard: blockInCard,
        });
        inHelp = false;
        blockStart = -1;
        blockInCard = false;
        currentLines = [];
        return;
      }
      currentLines.push(line);
      return;
    }

    if (!inFence && isHelpStartLine(line)) {
      inHelp = true;
      blockStart = index;
      blockInCard = inCard;
      currentLines = [];
    }
  });

  if (inHelp) {
    blocks.push({
      startIndex: blockStart,
      endIndex: Math.max(blockStart, lines.length - 1),
      text: trimEmptyLines(currentLines).join("\n").trim(),
      inCard: blockInCard,
    });
  }

  return blocks;
};

const stripHelpBlocksFromLines = (lines: string[]) => {
  const output: string[] = [];
  let inHelp = false;
  let inFence = false;
  let fenceToken = "";

  lines.forEach((line) => {
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
      if (!inHelp) {
        output.push(line);
      }
      return;
    }

    if (inHelp) {
      if (!inFence && isHelpEndLine(line)) {
        inHelp = false;
      }
      return;
    }
    if (!inFence && isHelpStartLine(line)) {
      inHelp = true;
      return;
    }
    output.push(line);
  });

  return output;
};

const splitCardBlocks = (lines: string[]): CardBlock[] => {
  const blocks: CardBlock[] = [];
  const tableLineIndices = findTableLineIndices(lines);
  let currentLines: string[] = [];
  let inFence = false;
  let fenceToken = "";

  const flushBlock = () => {
    const trimmed = trimEmptyLines(currentLines);
    if (trimmed.length > 0) {
      blocks.push({ contentLines: trimmed });
    }
    currentLines = [];
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
      currentLines.push(line);
      return;
    }

    if (!inFence && isSeparatorLine(line) && !tableLineIndices.has(index)) {
      flushBlock();
      return;
    }
    currentLines.push(line);
  });

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
    const rawLines = task.rawLines;
    const helpBlocks = collectHelpBlocks(rawLines);
    const taskHelpBlock = resolveTaskHelpBlock(rawLines, helpBlocks);
    const cardHelpTexts = helpBlocks
      .filter((block) => block !== taskHelpBlock)
      .map((block) => block.text);
    const cardSourceLines =
      task.cardLines.length > 0 ? task.cardLines : rawLines;
    const cardBlocks = splitCardBlocks(stripHelpBlocksFromLines(cardSourceLines));
    const headingInfo = deriveTaskHeadingInfo(rawLines, task.cardWrapper);
    let hasCardContent = false;
    let cardHelpIndex = 0;
    const pushCard = (card: CardBlueprint) => {
      if (cardHelpIndex < cardHelpTexts.length) {
        const helpText = cardHelpTexts[cardHelpIndex] ?? "";
        if (helpText.trim()) {
          card.helpText = helpText;
        }
      }
      cardHelpIndex += 1;
      cards.push(card);
    };

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
      if (trimmedLines.length > 0) {
        hasCardContent = true;
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
        };
        pushCard(fallbackCard);
        return;
      }
      parts.forEach((part) => {
        const partCards = buildCardsFromPart(part);
        if (part.kind === "true-false" && part.items.length > 1) {
          warnings.push("Multiple true/false statements were split into separate cards.");
        }
        partCards.forEach((card) => pushCard(card));
      });
    });

    if (cards.length === 0) {
      if (task.officialAnswer !== undefined) {
        let fallbackLines = stripLeadingTaskNumberLine(
          trimEmptyLines(normalizeLines(task.prompt)),
        );
        if (headingInfo.removeHeadingFromPrompt && fallbackLines.length > 0) {
          const dropCount = Math.min(
            headingInfo.headingLineCount || 1,
            fallbackLines.length,
          );
          fallbackLines = fallbackLines.slice(dropCount);
        }
        pushCard({
          id: createBlueprintId("card"),
          type: "qa",
          prompt: fallbackLines.join("\n").trim(),
          answer: task.officialAnswer ?? "",
        });
      } else if (!hasCardContent) {
        pushCard({
          id: createBlueprintId("card"),
          type: "qa",
          prompt: "",
          answer: "",
        });
      }
    }

    const taskBlueprint: ExamTaskBlueprint = {
      id: createBlueprintId("task"),
      order: index,
      title: headingInfo.heading,
      helpText: taskHelpBlock ? taskHelpBlock.text : undefined,
      useCardWrapper: task.cardWrapper,
      cards,
    };

    return taskBlueprint;
  });

  return { blueprint, warnings };
};
