/**
 * @file apps/fmd-desktop/src/features/exam-editor/serializer.ts
 *
 * Zweck:
 * - Serialisiert Exam-Blueprints zu Exam-Markdown.
 */

import { normalizeCardWrapperPlacement } from "../../lib/exam/autoCards";
import {
  serializePngEmbed,
  serializeSvgFence,
} from "../../lib/cardMedia";
import type {
  CardBlueprint,
  CardType,
  ChoiceOption,
  ExamBlueprint,
  ExamPassiveSegment,
  ExamTaskBlueprint,
} from "./types";

const normalizeLines = (value: string) => value.replace(/\r\n?/g, "\n").split("\n");

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

const cleanLines = (value: string) =>
  trimEmptyLines(normalizeLines(value).map((line) => line.trimEnd()));

const taskNumberPattern = /^\s*\d+\)\s*(.*)$/;

const stripLeadingTaskNumberLine = (lines: string[]) => {
  const next = lines.slice();
  for (let index = 0; index < next.length; index += 1) {
    const line = next[index];
    if (line.trim() === "") {
      continue;
    }
    const match = line.match(taskNumberPattern);
    if (match) {
      const remainder = match[1] ?? "";
      if (remainder.trim() === "") {
        next.splice(index, 1);
      } else {
        next[index] = remainder;
      }
    }
    break;
  }
  return next;
};

const formatOptionKey = (index: number) => {
  const code = "a".charCodeAt(0) + index;
  return String.fromCharCode(code);
};

const serializeHelpBlock = (helpText?: string) => {
  if (!helpText || helpText.trim() === "") {
    return [];
  }
  const lines = cleanLines(helpText);
  if (lines.length === 0) {
    return [];
  }
  return ["#help", ...lines, "#helpend"];
};

const serializeMediaBlocks = (
  mediaItems?: CardBlueprint["mediaItems"] | ExamTaskBlueprint["mediaItems"],
) => {
  if (!mediaItems || mediaItems.length === 0) {
    return [];
  }
  return mediaItems.map((draft) =>
    draft.type === "png"
      ? serializePngEmbed(draft.src, draft.label)
      : serializeSvgFence(draft.inlineSvg),
  );
};

const serializeQaCard = (card: Extract<CardBlueprint, { type: "qa" }>) => {
  const promptLines = cleanLines(card.prompt);
  const answerLines = cleanLines(card.answer);
  const [firstAnswer, ...restAnswer] = answerLines.length > 0 ? answerLines : [""];
  const answerLine = firstAnswer ? `Answer: ${firstAnswer}` : "Answer:";
  return [...promptLines, answerLine, ...restAnswer];
};

const serializeTfCard = (card: Extract<CardBlueprint, { type: "tf" }>) => {
  const promptLines = cleanLines(card.prompt);
  const marker = card.correct === "false" ? "false" : "true";
  return [...promptLines, `-${marker}`];
};

const serializeChoiceCard = (
  card: Extract<CardBlueprint, { type: "m1" | "m2" }>,
) => {
  const promptLines = cleanLines(card.prompt);
  const optionLines = card.options.map((option, index) => {
    const key = formatOptionKey(index);
    return `${key}) ${option.text}`.trimEnd();
  });
  const correctLines = card.options
    .map((option, index) => ({
      key: formatOptionKey(index),
      isCorrect: option.isCorrect,
    }))
    .filter((option) => option.isCorrect)
    .map((option) => `-${option.key}`);

  return [...promptLines, ...optionLines, ...correctLines];
};

const serializeClozeCard = (
  card: Extract<CardBlueprint, { type: "cl" | "cd" | "cld" }>,
) => cleanLines(card.prompt);

const serializeCardContent = (card: CardBlueprint) => {
  switch (card.type) {
    case "qa":
      return serializeQaCard(card);
    case "tf":
      return serializeTfCard(card);
    case "m1":
    case "m2":
      return serializeChoiceCard(card);
    case "cl":
    case "cd":
    case "cld":
      return serializeClozeCard(card);
    default: {
      const _exhaustive: never = card;
      void _exhaustive;
      return [];
    }
  }
};

const serializeCardBlock = (card: CardBlueprint, stripTaskNumber: boolean) => {
  const contentLines = serializeCardContent(card);
  const sanitizedContent = stripTaskNumber
    ? stripLeadingTaskNumberLine(contentLines)
    : contentLines;
  return [
    ...serializeMediaBlocks(card.mediaItems),
    ...sanitizedContent,
    ...serializeHelpBlock(card.helpText),
  ];
};

const serializeTask = (task: ExamTaskBlueprint, index: number) => {
  const lines: string[] = [];
  const wrapTask = task.useCardWrapper;
  if (wrapTask) {
    lines.push("#card");
  }
  const title = task.title.trim();
  lines.push(`${index + 1})${title ? ` ${title}` : ""}`);
  lines.push(...serializeHelpBlock(task.helpText));
  lines.push(...serializeMediaBlocks(task.mediaItems));
  task.cards.forEach((card, cardIndex) => {
    if (cardIndex > 0) {
      lines.push("---");
    }
    lines.push(...serializeCardBlock(card, cardIndex === 0));
  });
  if (wrapTask) {
    lines.push("#endcard");
  }
  return lines;
};

const serializeExamMeta = (exam: ExamBlueprint) => {
  const lines: string[] = [];
  if (exam.title.trim()) {
    lines.push(`# ${exam.title.trim()}`);
  }
  if (exam.description.trim()) {
    lines.push(...cleanLines(exam.description));
  }
  return lines;
};

export type SerializeExamBlueprintOptions = {
  passiveSegments?: ExamPassiveSegment[];
};

const normalizePassiveSegmentText = (value: string) =>
  trimEmptyLines(normalizeLines(value)).join("\n");

const resolvePassiveSegmentsBySlot = (
  passiveSegments?: ExamPassiveSegment[],
) => {
  const bySlot = new Map<number, string[]>();
  (passiveSegments ?? []).forEach((segment) => {
    const rawSlotIndex = Number.isFinite(segment.slotIndex)
      ? segment.slotIndex
      : 0;
    const slotIndex = Math.max(0, Math.floor(rawSlotIndex));
    const normalizedText = normalizePassiveSegmentText(segment.text ?? "");
    if (!normalizedText.trim()) {
      return;
    }
    const existing = bySlot.get(slotIndex) ?? [];
    existing.push(normalizedText);
    bySlot.set(slotIndex, existing);
  });
  return bySlot;
};

const joinSegmentTexts = (texts: string[]) => texts.join("\n---\n");

const mergeOverflowPassiveSegmentsIntoTrailingSlot = (
  passiveBySlot: Map<number, string[]>,
  trailingSlotIndex: number,
) => {
  const overflowEntries = Array.from(passiveBySlot.entries())
    .filter((entry) => entry[0] > trailingSlotIndex)
    .sort((left, right) => left[0] - right[0]);
  if (overflowEntries.length === 0) {
    return;
  }
  const trailingTexts = passiveBySlot.get(trailingSlotIndex) ?? [];
  overflowEntries.forEach((entry) => {
    trailingTexts.push(...entry[1]);
    passiveBySlot.delete(entry[0]);
  });
  passiveBySlot.set(trailingSlotIndex, trailingTexts);
};

export const serializeExamBlueprint = (
  exam: ExamBlueprint,
  options?: SerializeExamBlueprintOptions,
) => {
  const lines: string[] = ["#exam"];
  const passiveBySlot = resolvePassiveSegmentsBySlot(options?.passiveSegments);
  const orderedTasks = exam.tasks.slice().sort((a, b) => a.order - b.order);
  if (orderedTasks.length > 0) {
    mergeOverflowPassiveSegmentsIntoTrailingSlot(
      passiveBySlot,
      orderedTasks.length - 1,
    );
  }
  const metaLines = serializeExamMeta(exam);
  if (metaLines.length > 0) {
    lines.push(...metaLines, "");
  }
  orderedTasks.forEach((task, index) => {
    const taskLines = serializeTask(task, index);
    const trimmed = taskLines.slice();
    while (trimmed.length > 0 && trimmed[trimmed.length - 1]?.trim() === "") {
      trimmed.pop();
    }
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "---") {
      trimmed.pop();
    }
    while (trimmed.length > 0 && trimmed[trimmed.length - 1]?.trim() === "") {
      trimmed.pop();
    }
    const lastLine = trimmed[trimmed.length - 1] ?? "";
    const endsWithHelp = /^\s*#helpend\s*$/i.test(lastLine);
    if (endsWithHelp) {
      lines.push(...trimmed, "", "---");
    } else {
      lines.push(...trimmed, "---");
    }
    const slotTexts = passiveBySlot.get(index) ?? [];
    if (slotTexts.length > 0) {
      lines.push(...normalizeLines(joinSegmentTexts(slotTexts)));
      passiveBySlot.delete(index);
    }
  });

  const overflowTexts = Array.from(passiveBySlot.entries())
    .sort((left, right) => left[0] - right[0])
    .flatMap((entry) => entry[1]);
  if (overflowTexts.length > 0) {
    lines.push(...normalizeLines(joinSegmentTexts(overflowTexts)));
  }

  lines.push("#endexam");
  return normalizeCardWrapperPlacement(lines.join("\n")).content;
};

export const serializeCardTypeLabel = (cardType: CardType) => {
  switch (cardType) {
    case "qa":
      return "QA";
    case "tf":
      return "TF";
    case "m1":
      return "M1";
    case "m2":
      return "M2";
    case "cl":
      return "CL";
    case "cd":
      return "CD";
    case "cld":
      return "CLD";
    default: {
      const _exhaustive: never = cardType;
      void _exhaustive;
      return "";
    }
  }
};

export const buildChoiceOption = (index: number, option: ChoiceOption) => ({
  ...option,
  label: `${formatOptionKey(index)}) ${option.text}`.trimEnd(),
});
