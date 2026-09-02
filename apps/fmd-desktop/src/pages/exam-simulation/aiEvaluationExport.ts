import type { ExamManualTaskEntry } from "./examSimulationTypes";

const normalizeLineEndings = (value: string) => value.replace(/\r\n?/g, "\n");

const resolveQaParts = (entry: ExamManualTaskEntry) =>
  entry.task.card.parts
    .map((part, partIndex) =>
      part.kind === "free-text"
        ? {
            question: normalizeLineEndings(part.front),
            answer: normalizeLineEndings(entry.partStates[partIndex]?.textResponse ?? ""),
          }
        : null,
    )
    .filter((part): part is { question: string; answer: string } => part !== null);

export const hasAiEvaluationQaTasks = (entries: ExamManualTaskEntry[]) =>
  entries.some((entry) => resolveQaParts(entry).length > 0);

const renderMarkdownBlock = (heading: string, body: string) =>
  body.length > 0 ? `${heading}\n${body}` : heading;

export const buildAiEvaluationMarkdown = (entries: ExamManualTaskEntry[]) => {
  const qaTasks = entries.flatMap((entry) => {
    const qaParts = resolveQaParts(entry);
    if (qaParts.length === 0) {
      return [];
    }
    return [
      {
        question: qaParts.map((part) => part.question).join("\n\n"),
        answer: qaParts.map((part) => part.answer).join("\n\n"),
        maxPoints: entry.maxPoints,
      },
    ];
  });

  if (qaTasks.length === 0) {
    return "";
  }

  const taskBlocks = qaTasks.map((task, index) =>
    [
      `## Task ${index + 1}`,
      renderMarkdownBlock("### Question", task.question),
      renderMarkdownBlock("### User Answer", task.answer),
      renderMarkdownBlock("### Max Points", String(task.maxPoints)),
      renderMarkdownBlock("### Awarded", `__ / ${task.maxPoints}`),
    ].join("\n\n"),
  );

  return [
    "# AI Evaluation Request",
    "",
    "Please evaluate the following QA exam answers.  ",
    "Award points for each task based on the max score.",
    "",
    "---",
    "",
    taskBlocks.join("\n\n---\n\n"),
  ].join("\n");
};
