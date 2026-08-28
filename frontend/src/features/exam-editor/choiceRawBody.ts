/**
 * @file apps/fmd-desktop/src/features/exam-editor/choiceRawBody.ts
 *
 * Zweck:
 * - Parser/Serializer fuer den rohen M1/M2-Body im Exam-Editor.
 */

import { parseFlashcards } from "../../lib/flashcards";
import { createChoiceOption } from "./blueprint";
import type { ChoiceOption, MultipleChoiceCardBlueprint } from "./types";

type ParsedChoiceOption = {
  text: string;
  isCorrect: boolean;
};

export type ParsedChoiceRawBody = {
  prompt: string;
  options: ParsedChoiceOption[];
  recommendedType: "m1" | "m2";
};

const normalizeLines = (value: string) => value.replace(/\r\n?/g, "\n").split("\n");

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;
  while (start < end && (lines[start] ?? "").trim() === "") {
    start += 1;
  }
  while (end > start && (lines[end - 1] ?? "").trim() === "") {
    end -= 1;
  }
  return lines.slice(start, end);
};

const formatOptionKey = (index: number) => {
  const code = "a".charCodeAt(0) + index;
  return String.fromCharCode(code);
};

const buildPromptWithContext = (question: string, context?: string) => {
  if (!context || !context.trim()) {
    return question.trim();
  }
  if (!question.trim()) {
    return context.trim();
  }
  return `${question}\n${context}`.trim();
};

export const serializeChoiceRawBody = (
  card: Pick<MultipleChoiceCardBlueprint, "prompt" | "options">,
) => {
  const promptLines = trimEmptyLines(normalizeLines(card.prompt ?? ""));
  const optionLines = card.options.map((option, index) =>
    `${formatOptionKey(index)}) ${option.text}`.trimEnd(),
  );
  const markerLines = card.options
    .map((option, index) => ({ marker: `-${formatOptionKey(index)}`, isCorrect: option.isCorrect }))
    .filter((entry) => entry.isCorrect)
    .map((entry) => entry.marker);
  return trimEmptyLines([...promptLines, ...optionLines, ...markerLines]).join("\n");
};

export const parseChoiceRawBody = (
  rawBody: string,
): { parsed?: ParsedChoiceRawBody; error?: string } => {
  const source = trimEmptyLines(normalizeLines(rawBody)).join("\n");
  if (!source.trim()) {
    return { error: "Choice source is empty." };
  }

  const parsedCards = parseFlashcards(`#card\n${source}\n#endcard`, {
    answerMatch: "line-start",
  });
  const first = parsedCards[0];
  if (!first || first.kind !== "composite") {
    return { error: "No card syntax detected in choice source." };
  }
  if (first.parts.length !== 1 || first.parts[0]?.kind !== "multiple-choice") {
    return { error: "Choice source must contain exactly one multiple-choice part." };
  }

  const part = first.parts[0];
  const correctSet = new Set(part.correctKeys.map((key) => key.toLowerCase()));
  const options = part.options.map((option) => ({
    text: option.text,
    isCorrect: correctSet.has(option.key.toLowerCase()),
  }));
  if (options.length < 2) {
    return { error: "Choice source requires at least two options." };
  }

  return {
    parsed: {
      prompt: buildPromptWithContext(part.question, part.context),
      options,
      recommendedType: part.correctKeys.length > 1 ? "m2" : "m1",
    },
  };
};

export const mergeChoiceOptions = (
  currentOptions: ChoiceOption[],
  parsedOptions: ParsedChoiceOption[],
) =>
  parsedOptions.map((parsed, index) => ({
    ...(currentOptions[index]
      ? { id: currentOptions[index].id }
      : { id: createChoiceOption().id }),
    text: parsed.text,
    isCorrect: parsed.isCorrect,
  }));

