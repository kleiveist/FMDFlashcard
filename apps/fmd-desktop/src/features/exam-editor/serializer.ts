/**
 * @file apps/fmd-desktop/src/features/exam-editor/serializer.ts
 *
 * Zweck:
 * - Serialisiert Exam-Blueprints zu Exam-Markdown.
 */

import { parseExamTasks } from "../../lib/exam";
import { normalizeCardWrapperPlacement } from "../../lib/exam/autoCards";
import { serializePngEmbed, serializeSvgFence } from "../../lib/cardMedia";
import { buildTaskFingerprint } from "./stability";
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

const serializeChoiceCard = (card: Extract<CardBlueprint, { type: "m1" | "m2" }>) => {
  if (card.rawBody?.trim()) {
    return cleanLines(card.rawBody);
  }
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

const serializeClozeCard = (card: Extract<CardBlueprint, { type: "cl" | "cd" | "cld" }>) =>
  cleanLines(card.prompt);

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

export type SerializeExamBlueprintStableOptions = SerializeExamBlueprintOptions & {
  sourceMarkdown?: string | null;
};

const normalizePassiveSegmentText = (value: string) =>
  trimEmptyLines(normalizeLines(value)).join("\n");

const resolvePassiveSegmentsBySlot = (passiveSegments?: ExamPassiveSegment[]) => {
  const bySlot = new Map<number, string[]>();
  (passiveSegments ?? []).forEach((segment) => {
    const rawSlotIndex = Number.isFinite(segment.slotIndex) ? segment.slotIndex : 0;
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
    mergeOverflowPassiveSegmentsIntoTrailingSlot(passiveBySlot, orderedTasks.length - 1);
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

const extractSourceExamMeta = (sourceMarkdown: string, firstTaskStartLine: number | null) => {
  const lines = normalizeLines(sourceMarkdown);
  const examStartIndex = lines.findIndex((line) => /^\s*#exam\s*$/i.test(line));
  if (examStartIndex < 0) {
    return { title: "", description: "" };
  }
  const endIndex = firstTaskStartLine ?? lines.length;
  const metaLines = trimEmptyLines(
    lines
      .slice(examStartIndex + 1, endIndex)
      .filter((line) => !/^\s*#(?:exam|endexam|card|endcard|help|helpend)\s*$/i.test(line)),
  );
  if (metaLines.length === 0) {
    return { title: "", description: "" };
  }
  const headingMatch = metaLines[0]?.match(/^\s*#{1,6}\s+(.*)$/);
  if (!headingMatch) {
    return { title: "", description: metaLines.join("\n").trim() };
  }
  return {
    title: (headingMatch[1] ?? "").trim(),
    description: metaLines.slice(1).join("\n").trim(),
  };
};

const buildSerializedMetaSection = (exam: ExamBlueprint) => {
  const metaLines = serializeExamMeta(exam);
  return metaLines.length > 0 ? [...metaLines, ""] : [];
};

export const serializeExamBlueprintStable = (
  exam: ExamBlueprint,
  options?: SerializeExamBlueprintStableOptions,
) => {
  const regular = serializeExamBlueprint(exam, options);
  const sourceMarkdown = options?.sourceMarkdown ?? "";
  if (!sourceMarkdown.trim()) {
    return regular;
  }

  const parsedSource = parseExamTasks(sourceMarkdown);
  if (!parsedSource.hasExamBlock) {
    return regular;
  }

  const orderedTasks = exam.tasks.slice().sort((left, right) => left.order - right.order);
  if (parsedSource.tasks.length !== orderedTasks.length) {
    return regular;
  }
  if (
    orderedTasks.some(
      (task, index) => !task.sourceMeta || task.sourceMeta.sourceTaskIndex !== index,
    )
  ) {
    return regular;
  }

  const firstTaskStartLine = parsedSource.tasks[0]?.sourceRange.startLine ?? null;
  const sourceMeta = extractSourceExamMeta(sourceMarkdown, firstTaskStartLine);
  const examMetaUnchanged =
    sourceMeta.title === exam.title.trim() && sourceMeta.description === exam.description.trim();

  const changedTaskIndices = orderedTasks
    .map((task, index) => ({
      index,
      changed: !task.sourceMeta || buildTaskFingerprint(task) !== task.sourceMeta.sourceFingerprint,
    }))
    .filter((entry) => entry.changed)
    .map((entry) => entry.index);

  if (changedTaskIndices.length === 0 && examMetaUnchanged) {
    return sourceMarkdown;
  }

  const sourceLines = normalizeLines(sourceMarkdown);
  const descendingChanged = changedTaskIndices.sort((left, right) => right - left);

  for (const taskIndex of descendingChanged) {
    const sourceTask = parsedSource.tasks[taskIndex];
    const targetTask = orderedTasks[taskIndex];
    if (!sourceTask || !targetTask) {
      return regular;
    }
    const replaceStart = sourceTask.sourceRange.startLine;
    const replaceEnd = sourceTask.sourceRange.endLine;
    if (
      !Number.isFinite(replaceStart) ||
      !Number.isFinite(replaceEnd) ||
      replaceStart < 0 ||
      replaceEnd < replaceStart ||
      replaceEnd >= sourceLines.length
    ) {
      return regular;
    }
    const replacementLines = serializeTask(targetTask, taskIndex);
    sourceLines.splice(replaceStart, replaceEnd - replaceStart + 1, ...replacementLines);
  }

  if (!examMetaUnchanged) {
    const examStartLine = sourceLines.findIndex((line) => /^\s*#exam\s*$/i.test(line));
    if (examStartLine < 0) {
      return regular;
    }
    const firstTaskLineInSource = parsedSource.tasks[0]?.sourceRange.startLine;
    const examEndLine = sourceLines.findIndex(
      (line, index) => index > examStartLine && /^\s*#endexam\s*$/i.test(line),
    );
    const metaEndExclusive =
      typeof firstTaskLineInSource === "number"
        ? Math.max(examStartLine + 1, firstTaskLineInSource)
        : examEndLine >= 0
          ? examEndLine
          : sourceLines.length;
    const replacementMetaLines = buildSerializedMetaSection(exam);
    sourceLines.splice(
      examStartLine + 1,
      Math.max(0, metaEndExclusive - (examStartLine + 1)),
      ...replacementMetaLines,
    );
  }

  return sourceLines.join("\n");
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
