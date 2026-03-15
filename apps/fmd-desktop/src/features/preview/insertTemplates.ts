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
  | "m1"
  | "m2"
  | "qa"
  | "tf";

export type AdvancedInsertTemplateGroupId =
  | "flashcard"
  | "qa"
  | "true-false"
  | "choice"
  | "cloze"
  | "exam"
  | "markdown";

export type AdvancedInsertTemplateIconId =
  | "advanced-qa"
  | "advanced-tf"
  | "advanced-m1"
  | "advanced-m2"
  | "advanced-cl"
  | "advanced-cd"
  | "advanced-cld";

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
  taskPayload: string;
  taskFirstPlaceholder: string;
  icon: AdvancedInsertTemplateIconId;
  contextRules?: AdvancedInsertTemplateContextRules;
};

export type AdvancedInsertTemplateVariant = "card" | "task";

export type ResolvedAdvancedInsertTemplate = {
  payload: string;
  firstPlaceholder: string;
};

const ADVANCED_TASK_NUMBER_PLACEHOLDER = "{{TASK_NUMBER}}";

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
    icon: "advanced-qa",
    payload: "#card\nQUESTION TEXT\n\nAnswer: ANSWER TEXT\n#endcard",
    firstPlaceholder: "QUESTION TEXT",
    taskPayload:
      "{{TASK_NUMBER}}) TASK HEADING\nTASK DESCRIPTION\nAnswer: ANSWER TEXT\n\n---",
    taskFirstPlaceholder: "TASK HEADING",
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
    icon: "advanced-tf",
    payload: "#card\nSTATEMENT TEXT\n-true\n#endcard",
    firstPlaceholder: "STATEMENT TEXT",
    taskPayload:
      "{{TASK_NUMBER}}) TASK HEADING\nTASK DESCRIPTION\n-true\n\n---",
    taskFirstPlaceholder: "TASK HEADING",
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
    icon: "advanced-m1",
    payload: "#card\nQUESTION TEXT\na) OPTION A\nb) OPTION B\nc) OPTION C\n-a\n#endcard",
    firstPlaceholder: "QUESTION TEXT",
    taskPayload:
      "{{TASK_NUMBER}}) TASK HEADING\nTASK DESCRIPTION\na) OPTION A\nb) OPTION B\nc) OPTION C\n-a\n\n---",
    taskFirstPlaceholder: "TASK HEADING",
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
    icon: "advanced-m2",
    payload:
      "#card\nQUESTION TEXT\na) OPTION A\nb) OPTION B\nc) OPTION C\nd) OPTION D\n-a\n-c\n#endcard",
    firstPlaceholder: "QUESTION TEXT",
    taskPayload:
      "{{TASK_NUMBER}}) TASK HEADING\nTASK DESCRIPTION\na) OPTION A\nb) OPTION B\nc) OPTION C\nd) OPTION D\n-a\n-c\n\n---",
    taskFirstPlaceholder: "TASK HEADING",
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
    icon: "advanced-cl",
    payload: "#card\nSENTENCE BEFORE %ANSWER1% SENTENCE AFTER\n#endcard",
    firstPlaceholder: "ANSWER1",
    taskPayload:
      "{{TASK_NUMBER}}) TASK HEADING\nTASK DESCRIPTION WITH %ANSWER1%\n\n---",
    taskFirstPlaceholder: "TASK HEADING",
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
    icon: "advanced-cd",
    payload:
      '#card\nSENTENCE WITH TOKENS tocken "TOKEN1", tocken "TOKEN2", tocken "TOKEN3".\n#endcard',
    firstPlaceholder: "TOKEN1",
    taskPayload:
      '{{TASK_NUMBER}}) TASK HEADING\nTASK DESCRIPTION with "TOKEN1", "TOKEN2", "TOKEN3".\n\n---',
    taskFirstPlaceholder: "TASK HEADING",
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
    icon: "advanced-cld",
    payload:
      '#card\nSENTENCE BEFORE %ANSWER1% SENTENCE MIDDLE %ANSWER2% SENTENCE AFTER\n\nTOKEN BANK tocken "TOKENA", tocken "TOKENB", tocken "TOKENC"\n#endcard',
    firstPlaceholder: "ANSWER1",
    taskPayload:
      '{{TASK_NUMBER}}) TASK HEADING\nTASK DESCRIPTION WITH %ANSWER1% AND %ANSWER2%\n\nTOKEN BANK "TOKENA", "TOKENB", "TOKENC"\n\n---',
    taskFirstPlaceholder: "TASK HEADING",
    contextRules: {
      hideInsideCard: true,
    },
  },
];

export const getAdvancedInsertTemplateById = (id: string) =>
  ADVANCED_INSERT_TEMPLATE_CATALOG.find((template) => template.id === id);

export const buildAdvancedInsertTemplateVariant = (
  template: AdvancedInsertTemplateDefinition,
  variant: AdvancedInsertTemplateVariant,
  options?: { sequenceNumber?: number },
): ResolvedAdvancedInsertTemplate => {
  const sequenceNumber = Math.max(1, options?.sequenceNumber ?? 1);

  if (variant === "card") {
    const cardLines = template.payload.split("\n");
    const cardStartIndex = cardLines.findIndex((line) => line.trim().toLowerCase() === "#card");
    if (cardStartIndex >= 0) {
      cardLines.splice(cardStartIndex + 1, 0, `${sequenceNumber}) CARD HEADING`);
    }
    return {
      payload: cardLines.join("\n"),
      firstPlaceholder: template.firstPlaceholder,
    };
  }

  return {
    payload: template.taskPayload.split(ADVANCED_TASK_NUMBER_PLACEHOLDER).join(String(sequenceNumber)),
    firstPlaceholder: template.taskFirstPlaceholder,
  };
};

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
