/**
 * Flashcard syntax v1 (multiple choice):
 * #card
 * Question line
 * a) Option text
 * -a
 * #
 *
 * Invalid cards (missing end marker, empty question, no options) are skipped.
 */
export type FlashcardOption = {
  key: string;
  text: string;
};

export type Flashcard = {
  question: string;
  options: FlashcardOption[];
  correctKeys: string[];
};

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const optionPattern = /^([A-Za-z])\)\s+(.*)$/;
const markerPattern = /^-([A-Za-z])$/;

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
      const trimmed = lines[index].trim();
      if (trimmed === "#") {
        foundEnd = true;
        index += 1;
        break;
      }
      if (trimmed === "#card") {
        break;
      }
      if (!trimmed) {
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

      index += 1;
    }

    if (question && options.length > 0 && foundEnd) {
      cards.push({ question, options, correctKeys });
    }
  }

  return cards;
};
