import { SyntaxEntry } from "../types";

import { examBlockEntry } from "./sections/ExamBlock";
import { cardBlockEntry } from "./sections/CardBlock";
import { helpBlockEntry } from "./sections/helpBlock";
import { promptExamEntry } from "./sections/PromptExam";

export const structuredSyntaxEntries: SyntaxEntry[] = [
  examBlockEntry,
  cardBlockEntry,
  helpBlockEntry,
  promptExamEntry,
];
