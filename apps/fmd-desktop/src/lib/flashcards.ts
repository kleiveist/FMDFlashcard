/**
 * Flashcard syntax:
 * v1 (multiple choice)
 * #card
 * Question line
 * a) Option text
 * -a
 * #
 *
 * v3 (cloze text)
 * #card
 * Question line
 * Body text with blanks like %%answer%%
 * #
 *
 * Invalid cards (missing end marker, empty question, no options/answers) are skipped.
 */
export type FlashcardOption = {
  key: string;
  text: string;
};

export type MultipleChoiceCard = {
  kind: "multiple-choice";
  question: string;
  options: FlashcardOption[];
  correctKeys: string[];
};

export type ClozeSegment =
  | { type: "text"; value: string }
  | { type: "blank"; answer: string };

export type ClozeCard = {
  kind: "cloze";
  question: string;
  segments: ClozeSegment[];
  answers: string[];
};

export type Flashcard = MultipleChoiceCard | ClozeCard;

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const optionPattern = /^([A-Za-z])\)\s+(.*)$/;
const markerPattern = /^-([A-Za-z])$/;

const parseClozeSegments = (body: string) => {
  const segments: ClozeSegment[] = [];
  const answers: string[] = [];
  let cursor = 0;

  while (cursor < body.length) {
    const start = body.indexOf("%%", cursor);
    if (start === -1) {
      if (cursor < body.length) {
        segments.push({ type: "text", value: body.slice(cursor) });
      }
      break;
    }
    if (start > cursor) {
      segments.push({ type: "text", value: body.slice(cursor, start) });
    }
    const end = body.indexOf("%%", start + 2);
    if (end === -1) {
      segments.push({ type: "text", value: body.slice(start) });
      break;
    }

    const rawAnswer = body.slice(start + 2, end);
    const answer = rawAnswer.trim();
    if (!answer) {
      return null;
    }
    segments.push({ type: "blank", answer });
    answers.push(answer);
    cursor = end + 2;
  }

  return { segments, answers };
};

export const normalizeClozeAnswer = (value: string) =>
  value.trim().toLowerCase();

export const isClozeAnswerMatch = (input: string, answer: string) =>
  normalizeClozeAnswer(input) === normalizeClozeAnswer(answer);

const pushUnique = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

export const parseFlashcards = (markdown: string): Flashcard[] => {
  const lines = normalizeLines(markdown);
  const cards: Flashcard[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (line !== "#card") {
      index += 1;
      continue;
    }

    let question = "";
    const options: FlashcardOption[] = [];
    const correctKeys: string[] = [];
    const bodyLines: string[] = [];
    let foundEnd = false;

    index += 1;

    while (index < lines.length) {
      const trimmed = lines[index].trim();
      if (!trimmed) {
        index += 1;
        continue;
      }
      if (trimmed === "#") {
        foundEnd = true;
        index += 1;
        break;
      }
      if (trimmed === "#card") {
        break;
      }
      question = trimmed;
      index += 1;
      break;
    }

    while (index < lines.length) {
      const rawLine = lines[index];
      const trimmed = rawLine.trim();
      if (trimmed === "#") {
        foundEnd = true;
        index += 1;
        break;
      }
      if (trimmed === "#card") {
        break;
      }
      if (!trimmed) {
        bodyLines.push("");
        index += 1;
        continue;
      }

      const optionMatch = trimmed.match(optionPattern);
      if (optionMatch) {
        const text = optionMatch[2].trim();
        if (text) {
          options.push({
            key: optionMatch[1].toLowerCase(),
            text,
          });
        }
        index += 1;
        continue;
      }

      const markerMatch = trimmed.match(markerPattern);
      if (markerMatch) {
        pushUnique(correctKeys, markerMatch[1].toLowerCase());
        index += 1;
        continue;
      }

      bodyLines.push(rawLine);
      index += 1;
    }

    if (!question || !foundEnd) {
      continue;
    }

    if (options.length > 0) {
      cards.push({ kind: "multiple-choice", question, options, correctKeys });
      continue;
    }

    const body = bodyLines.join("\n").trim();
    const parsed = parseClozeSegments(body);
    if (!parsed) {
      continue;
    }
    if (parsed.answers.length > 0) {
      cards.push({
        kind: "cloze",
        question,
        segments: parsed.segments,
        answers: parsed.answers,
      });
    }
  }

  return cards;
};
