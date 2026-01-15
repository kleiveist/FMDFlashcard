import { SyntaxEntry } from "../types";

import { separatorBlockEntry } from "./entries/separatorBlock";
import { helpBlockEntry } from "./entries/helpBlock";
import { qaClassicEntry } from "./entries/qaClassic";
import { mcSingleEntry } from "./entries/mcSingle";
import { mcMultiEntry } from "./entries/mcMulti";
import { trueFalseEntry } from "./entries/trueFalse";
import { inlineCodeMultiEntry } from "./entries/inlineCodeMulti";
import { clozeTypedEntry } from "./entries/clozeTyped";
import { clozeInlineEntry } from "./entries/clozeInline";

export const flashcardSyntaxEntries: SyntaxEntry[] = [
  separatorBlockEntry,
  helpBlockEntry,
  qaClassicEntry,
  mcSingleEntry,
  mcMultiEntry,
  trueFalseEntry,
  inlineCodeMultiEntry,
  clozeTypedEntry,
  clozeInlineEntry,
];
