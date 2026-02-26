/**
 * @file apps/fmd-desktop/src/features/preview/insertTemplates.ts
 *
 * Zweck:
 * - Zentrale, datengetriebene Insert-Template-Registry fuer den Hybrid-Editor.
 * - Gruppierung, Kontextfilterung und Priorisierung fuer den Advanced-Bereich.
 */

export type AdvancedInsertTemplateMode =
  | "cd"
  | "cl"
  | "cld"
  | "e"
  | "ea"
  | "m1"
  | "m2"
  | "qa"
  | "tf"
  | "code-block"
  | "formula-block";

export type AdvancedInsertTemplateGroupId =
  | "flashcard"
  | "qa"
  | "true-false"
  | "choice"
  | "cloze"
  | "exam"
  | "markdown";

export type AdvancedInsertTemplateContext = {
  insideCard: boolean;
  insideExam: boolean;
};

type AdvancedInsertTemplateContextRules = {
  hideInsideCard?: boolean;
  prioritizeInsideExam?: boolean;
};

export type AdvancedInsertTemplateDefinition = {
  id: string;
  label: string;
  description: string;
  mode: AdvancedInsertTemplateMode;
  groupId: AdvancedInsertTemplateGroupId;
  payload: string;
  firstPlaceholder: string;
  contextRules?: AdvancedInsertTemplateContextRules;
};

export const ADVANCED_INSERT_TEMPLATE_GROUPS: ReadonlyArray<{
  id: AdvancedInsertTemplateGroupId;
  label: string;
}> = [
  { id: "flashcard", label: "Flashcard" },
  { id: "qa", label: "QA" },
  { id: "true-false", label: "True/False" },
  { id: "choice", label: "Choice" },
  { id: "cloze", label: "Cloze" },
  { id: "exam", label: "Exam" },
  { id: "markdown", label: "Markdown" },
];

export const ADVANCED_INSERT_TEMPLATE_CATALOG: ReadonlyArray<AdvancedInsertTemplateDefinition> = [
  {
    id: "flashcard-qa",
    label: "Answer Marker",
    description: "Question + Answer: marker (qa)",
    mode: "qa",
    groupId: "qa",
    payload: "#card\nQUESTION TEXT\n\nAnswer: ANSWER TEXT\n#endcard",
    firstPlaceholder: "QUESTION TEXT",
    contextRules: {
      hideInsideCard: true,
    },
  },
  {
    id: "flashcard-tf",
    label: "True / False",
    description: "Statement with -true marker (tf)",
    mode: "tf",
    groupId: "true-false",
    payload: "#card\nSTATEMENT TEXT\n-true\n#endcard",
    firstPlaceholder: "STATEMENT TEXT",
    contextRules: {
      hideInsideCard: true,
    },
  },
  {
    id: "flashcard-m1",
    label: "Multiple Choice (1)",
    description: "Single correct option (m1)",
    mode: "m1",
    groupId: "choice",
    payload: "#card\nQUESTION TEXT\na) OPTION A\nb) OPTION B\nc) OPTION C\n-a\n#endcard",
    firstPlaceholder: "QUESTION TEXT",
    contextRules: {
      hideInsideCard: true,
    },
  },
  {
    id: "flashcard-m2",
    label: "Multiple Choice (n)",
    description: "Multiple correct options (m2)",
    mode: "m2",
    groupId: "choice",
    payload:
      "#card\nQUESTION TEXT\na) OPTION A\nb) OPTION B\nc) OPTION C\nd) OPTION D\n-a\n-c\n#endcard",
    firstPlaceholder: "QUESTION TEXT",
    contextRules: {
      hideInsideCard: true,
    },
  },
  {
    id: "flashcard-cl",
    label: "Cloze Typed",
    description: "Typed blank with %...% (cl)",
    mode: "cl",
    groupId: "cloze",
    payload: "#card\nSENTENCE BEFORE %ANSWER1% SENTENCE AFTER\n#endcard",
    firstPlaceholder: "ANSWER1",
    contextRules: {
      hideInsideCard: true,
    },
  },
  {
    id: "flashcard-cd",
    label: "Cloze Drag",
    description: "Drag tokens with quoted token bank (cd)",
    mode: "cd",
    groupId: "cloze",
    payload:
      '#card\nSENTENCE WITH TOKENS tocken "TOKEN1", tocken "TOKEN2", tocken "TOKEN3".\n#endcard',
    firstPlaceholder: "TOKEN1",
    contextRules: {
      hideInsideCard: true,
    },
  },
  {
    id: "flashcard-cld",
    label: "Cloze Mixed",
    description: "Typed blanks + drag tokens (cld)",
    mode: "cld",
    groupId: "cloze",
    payload:
      '#card\nSENTENCE BEFORE %ANSWER1% SENTENCE MIDDLE %ANSWER2% SENTENCE AFTER\n\nTOKEN BANK tocken "TOKENA", tocken "TOKENB", tocken "TOKENC"\n#endcard',
    firstPlaceholder: "ANSWER1",
    contextRules: {
      hideInsideCard: true,
    },
  },
  {
    id: "exam-e",
    label: "Exam Wrapper",
    description: "Exam block with 3 task placeholders (e)",
    mode: "e",
    groupId: "exam",
    payload:
      "#exam\nOPTIONAL EXAM INTRO TEXT\n\n1) TASK 1 PROMPT (QA)\nAnswer: OFFICIAL ANSWER TEXT\n---\n\n2) TASK 2 PROMPT (TF)\nSTATEMENT TEXT\n-true\n---\n\n3) TASK 3 PROMPT (M1)\na) OPTION A\nb) OPTION B\nc) OPTION C\n-a\n#endexam",
    firstPlaceholder: "OPTIONAL EXAM INTRO TEXT",
    contextRules: {
      hideInsideCard: true,
      prioritizeInsideExam: true,
    },
  },
  {
    id: "exam-ea",
    label: "Exam Task Blueprint",
    description: "Single numbered exam task chunk (ea)",
    mode: "ea",
    groupId: "exam",
    payload: "1) TASK PROMPT TEXT\nTASK CONTEXT LINE\nAnswer: OFFICIAL ANSWER TEXT\n---",
    firstPlaceholder: "TASK PROMPT TEXT",
    contextRules: {
      prioritizeInsideExam: true,
    },
  },
  {
    id: "markdown-code-block",
    label: "Code Block",
    description: "Fenced code block",
    mode: "code-block",
    groupId: "markdown",
    payload: "```txt\nCODE HERE\n```",
    firstPlaceholder: "CODE HERE",
  },
  {
    id: "markdown-formula-block",
    label: "Formula Block",
    description: "Fenced math block",
    mode: "formula-block",
    groupId: "markdown",
    payload: "```math\nx = y\n```",
    firstPlaceholder: "x = y",
  },
];

export type AdvancedInsertTemplateSection = {
  id: AdvancedInsertTemplateGroupId;
  label: string;
  items: AdvancedInsertTemplateDefinition[];
};

export const getAdvancedInsertTemplateSections = (
  context: AdvancedInsertTemplateContext,
): AdvancedInsertTemplateSection[] => {
  const visibleItems = ADVANCED_INSERT_TEMPLATE_CATALOG.filter((item) => {
    if (context.insideCard && item.contextRules?.hideInsideCard) {
      return false;
    }
    return true;
  });

  const baseOrder = ADVANCED_INSERT_TEMPLATE_GROUPS.map((group) => group.id);
  const groupOrder = context.insideExam
    ? (["exam", ...baseOrder.filter((groupId) => groupId !== "exam")] as AdvancedInsertTemplateGroupId[])
    : baseOrder;

  return groupOrder
    .map((groupId) => {
      const group = ADVANCED_INSERT_TEMPLATE_GROUPS.find((entry) => entry.id === groupId);
      if (!group) {
        return null;
      }
      const items = visibleItems
        .filter((item) => item.groupId === groupId)
        .sort((left, right) => {
          const leftPriority = context.insideExam && left.contextRules?.prioritizeInsideExam ? 0 : 1;
          const rightPriority = context.insideExam && right.contextRules?.prioritizeInsideExam ? 0 : 1;
          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }
          return left.label.localeCompare(right.label);
        });
      if (items.length === 0) {
        return null;
      }
      return {
        id: group.id,
        label: group.label,
        items,
      };
    })
    .filter((section): section is AdvancedInsertTemplateSection => section !== null);
};
