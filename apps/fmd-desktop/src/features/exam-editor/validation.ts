/**
 * @file apps/fmd-desktop/src/features/exam-editor/validation.ts
 *
 * Zweck:
 * - Validiert Exam-Editor Blueprints ohne Help-Content.
 */

import type { CardBlueprint, ExamBlueprint, ExamTaskBlueprint } from "./types";

export type CardValidation = {
  valid: boolean;
  errors: string[];
  fieldErrors: {
    prompt?: string;
    answer?: string;
    correct?: string;
    options?: string;
    syntax?: string;
  };
  optionErrors: Record<string, string>;
};

export type TaskValidation = {
  taskId: string;
  valid: boolean;
  errors: string[];
  cardValidations: CardValidation[];
};

export type ExamValidation = {
  valid: boolean;
  errors: string[];
  taskValidations: TaskValidation[];
};

const hasText = (value: string) => value.trim().length > 0;

const collectErrors = (validation: CardValidation) => {
  const messages = Object.values(validation.fieldErrors).filter(Boolean) as string[];
  const optionMessages = Object.values(validation.optionErrors).filter(Boolean);
  return [...messages, ...optionMessages];
};

const validatePrompt = (prompt: string, validation: CardValidation) => {
  if (!hasText(prompt)) {
    validation.fieldErrors.prompt = "Prompt is required.";
  }
};

const analyzeCloze = (prompt: string) => {
  const pattern = /%%(.*?)%%/g;
  let match: RegExpExecArray | null = null;
  let count = 0;
  let hasEmpty = false;
  while ((match = pattern.exec(prompt)) !== null) {
    const content = (match[1] ?? "").trim();
    if (!content) {
      hasEmpty = true;
    } else {
      count += 1;
    }
  }
  return { count, hasEmpty };
};

const analyzeTokens = (prompt: string) => {
  const pattern = /`([^`]+)`/g;
  let match: RegExpExecArray | null = null;
  let count = 0;
  let hasEmpty = false;
  while ((match = pattern.exec(prompt)) !== null) {
    const content = (match[1] ?? "").trim();
    if (!content) {
      hasEmpty = true;
    } else {
      count += 1;
    }
  }
  return { count, hasEmpty };
};

const validateQaCard = (
  card: Extract<CardBlueprint, { type: "qa" }>,
): CardValidation => {
  const validation: CardValidation = {
    valid: false,
    errors: [],
    fieldErrors: {},
    optionErrors: {},
  };
  validatePrompt(card.prompt, validation);
  if (!hasText(card.answer)) {
    validation.fieldErrors.answer = "Answer is required.";
  }
  validation.errors = collectErrors(validation);
  validation.valid = validation.errors.length === 0;
  return validation;
};

const validateTfCard = (
  card: Extract<CardBlueprint, { type: "tf" }>,
): CardValidation => {
  const validation: CardValidation = {
    valid: false,
    errors: [],
    fieldErrors: {},
    optionErrors: {},
  };
  validatePrompt(card.prompt, validation);
  if (!card.correct) {
    validation.fieldErrors.correct = "Select true or false.";
  }
  validation.errors = collectErrors(validation);
  validation.valid = validation.errors.length === 0;
  return validation;
};

const validateChoiceCard = (
  card: Extract<CardBlueprint, { type: "m1" | "m2" }>,
): CardValidation => {
  const validation: CardValidation = {
    valid: false,
    errors: [],
    fieldErrors: {},
    optionErrors: {},
  };
  validatePrompt(card.prompt, validation);
  const nonEmptyOptions = card.options.filter((option) => hasText(option.text));
  if (nonEmptyOptions.length < 2) {
    validation.fieldErrors.options = "At least two options are required.";
  }
  card.options.forEach((option) => {
    if (!hasText(option.text)) {
      validation.optionErrors[option.id] = "Option text is required.";
    }
  });
  const correctOptions = nonEmptyOptions.filter((option) => option.isCorrect);
  if (card.type === "m1") {
    if (correctOptions.length !== 1) {
      validation.fieldErrors.correct = "Select exactly one correct option.";
    }
  } else if (correctOptions.length < 2) {
    validation.fieldErrors.correct = "Select at least two correct options.";
  }
  validation.errors = collectErrors(validation);
  validation.valid = validation.errors.length === 0;
  return validation;
};

const validateClozeCard = (
  card: Extract<CardBlueprint, { type: "cl" | "cd" | "cld" }>,
): CardValidation => {
  const validation: CardValidation = {
    valid: false,
    errors: [],
    fieldErrors: {},
    optionErrors: {},
  };
  validatePrompt(card.prompt, validation);
  const cloze = analyzeCloze(card.prompt);
  const tokens = analyzeTokens(card.prompt);
  const syntaxMessages: string[] = [];

  if (card.type === "cl" || card.type === "cld") {
    if (cloze.count === 0) {
      syntaxMessages.push("Add at least one cloze blank (%%...%%).");
    }
    if (cloze.hasEmpty) {
      syntaxMessages.push("Cloze blanks must not be empty.");
    }
  }

  if (card.type === "cd" || card.type === "cld") {
    if (tokens.count === 0) {
      syntaxMessages.push("Add at least one drag token (inline `token`).");
    }
    if (tokens.hasEmpty) {
      syntaxMessages.push("Drag tokens must not be empty.");
    }
  }

  if (syntaxMessages.length > 0) {
    validation.fieldErrors.syntax = syntaxMessages.join(" ");
  }

  validation.errors = collectErrors(validation);
  validation.valid = validation.errors.length === 0;
  return validation;
};

export const validateCard = (card: CardBlueprint): CardValidation => {
  switch (card.type) {
    case "qa":
      return validateQaCard(card);
    case "tf":
      return validateTfCard(card);
    case "m1":
    case "m2":
      return validateChoiceCard(card);
    case "cl":
    case "cd":
    case "cld":
      return validateClozeCard(card);
    default: {
      const _exhaustive: never = card;
      return {
        valid: false,
        errors: ["Unsupported card type."],
        fieldErrors: { prompt: "Unsupported card type." },
        optionErrors: {},
      };
    }
  }
};

export const validateTask = (task: ExamTaskBlueprint): TaskValidation => {
  const cardValidations = task.cards.map((card) => validateCard(card));
  const errors: string[] = [];
  if (task.cards.length === 0) {
    errors.push("Task requires at least one part.");
  }
  const isValid =
    errors.length === 0 && cardValidations.every((entry) => entry.valid);
  return {
    taskId: task.id,
    valid: isValid,
    errors,
    cardValidations,
  };
};

export const validateExamBlueprint = (exam: ExamBlueprint): ExamValidation => {
  const taskValidations = exam.tasks.map((task) => validateTask(task));
  const errors: string[] = [];
  if (exam.tasks.length === 0) {
    errors.push("Exam requires at least one task.");
  }
  const valid =
    errors.length === 0 && taskValidations.every((task) => task.valid);
  return {
    valid,
    errors,
    taskValidations,
  };
};

export const isCompositeTask = (task: ExamTaskBlueprint) => task.cards.length > 1;
