import { SyntaxEntry } from "../types";

import { examBlockEntry } from "./sections/ExamBlock";
import { cardBlockEntry } from "./sections/CardBlock";
import { helpBlockEntry } from "./sections/helpBlock";

export const structuredSyntaxEntries: SyntaxEntry[] = [
  examBlockEntry,
  cardBlockEntry,
  helpBlockEntry,
];
