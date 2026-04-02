/**
 * @file apps/fmd-desktop/src/lib/taskAreaToggle.ts
 *
 * Shared task/card area toggle helpers.
 */

export type TaskMutationSourceRange = {
  startLine: number;
  endLine: number;
};

export type TaskMutationScope = {
  sourcePath: string;
  sourceRange: TaskMutationSourceRange;
};

export type TaskAreaMutation = {
  lines: string[];
  delta: number;
  changed: boolean;
};

export type TaskAreaMutators = {
  findWrapper?: (
    lines: string[],
    range: TaskMutationSourceRange,
  ) => unknown | null;
  addWrapper: (lines: string[], range: TaskMutationSourceRange) => TaskAreaMutation;
  removeWrapper: (lines: string[], range: TaskMutationSourceRange) => TaskAreaMutation;
};

export type TaskAreaToggleParams = {
  scope: TaskMutationScope;
  nextEnabled: boolean;
  mutators: TaskAreaMutators;
  readSource: (path: string) => Promise<string>;
  writeSource: (path: string, contents: string) => Promise<void>;
  onSourceUpdated?: (params: {
    scope: TaskMutationScope;
    contents: string;
    wroteFile: boolean;
  }) => void | Promise<void>;
  onRescanVault?: () => Promise<boolean>;
};

export type TaskAreaToggleResult = {
  nextContents: string;
  wroteFile: boolean;
  rescanOk: boolean;
};

const hasFiniteLine = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const resolveTaskMutationScope = (params: {
  sourcePath?: string | null;
  sourceRange?: TaskMutationSourceRange | null;
}) => {
  const sourcePath = params.sourcePath?.trim() ?? "";
  if (!sourcePath) {
    return {
      scope: null,
      reason: "This card has no source file reference.",
    } as const;
  }

  const range = params.sourceRange;
  if (
    !range ||
    !hasFiniteLine(range.startLine) ||
    !hasFiniteLine(range.endLine) ||
    range.startLine < 0 ||
    range.endLine < range.startLine
  ) {
    return {
      scope: null,
      reason: "Task source range is unavailable.",
    } as const;
  }

  return {
    scope: {
      sourcePath,
      sourceRange: {
        startLine: range.startLine,
        endLine: range.endLine,
      },
    },
    reason: "",
  } as const;
};

export const applyTaskAreaToggle = async ({
  scope,
  nextEnabled,
  mutators,
  readSource,
  writeSource,
  onSourceUpdated,
  onRescanVault,
}: TaskAreaToggleParams): Promise<TaskAreaToggleResult> => {
  const contents = await readSource(scope.sourcePath);
  let lines = contents.replace(/\r\n?/g, "\n").split("\n");

  if (!nextEnabled && mutators.findWrapper && !mutators.findWrapper(lines, scope.sourceRange)) {
    throw new Error("Could not identify an exact #card/#endcard wrapper for this task.");
  }

  const mutation = nextEnabled
    ? mutators.addWrapper(lines, scope.sourceRange)
    : mutators.removeWrapper(lines, scope.sourceRange);
  lines = mutation.lines;

  const nextContents = lines.join("\n");
  const wroteFile = mutation.changed;
  if (wroteFile) {
    await writeSource(scope.sourcePath, nextContents);
  }

  if (onSourceUpdated) {
    await onSourceUpdated({
      scope,
      contents: nextContents,
      wroteFile,
    });
  }

  let rescanOk = true;
  if (onRescanVault) {
    rescanOk = await onRescanVault();
  }

  return {
    nextContents,
    wroteFile,
    rescanOk,
  };
};

export const toggleTaskMembership = applyTaskAreaToggle;

export const removeTaskAreaToggle = async (
  params: Omit<TaskAreaToggleParams, "nextEnabled">,
) =>
  applyTaskAreaToggle({
    ...params,
    nextEnabled: false,
  });
