import { describe, expect, it, vi } from "vitest";
import { applyTaskAreaToggle, resolveTaskMutationScope } from "./taskAreaToggle";

describe("resolveTaskMutationScope", () => {
  it("rejects missing source path and invalid ranges", () => {
    const missingPath = resolveTaskMutationScope({
      sourcePath: "",
      sourceRange: { startLine: 1, endLine: 2 },
    });
    expect(missingPath.scope).toBeNull();
    expect(missingPath.reason).toContain("source file");

    const invalidRange = resolveTaskMutationScope({
      sourcePath: "/vault/note.md",
      sourceRange: { startLine: 4, endLine: 1 },
    });
    expect(invalidRange.scope).toBeNull();
    expect(invalidRange.reason).toContain("range");
  });
});

describe("applyTaskAreaToggle", () => {
  it("forwards full task scope to update callback and writes the mutated source", async () => {
    const scope = {
      sourcePath: "/vault/note.md",
      sourceRange: {
        startLine: 1,
        endLine: 2,
      },
    };
    const readSource = vi.fn().mockResolvedValue(
      ["Intro", "Task line 1", "Task line 2", "Outro"].join("\n"),
    );
    const writeSource = vi.fn().mockResolvedValue(undefined);
    const onSourceUpdated = vi.fn();
    const onRescanVault = vi.fn().mockResolvedValue(true);

    const result = await applyTaskAreaToggle({
      scope,
      nextEnabled: true,
      mutators: {
        addWrapper: (lines, range) => {
          const next = [...lines];
          next.splice(range.startLine, 0, "#card");
          next.splice(range.endLine + 2, 0, "#endcard");
          return {
            lines: next,
            delta: 2,
            changed: true,
          };
        },
        removeWrapper: (lines) => ({
          lines,
          delta: 0,
          changed: false,
        }),
      },
      readSource,
      writeSource,
      onSourceUpdated,
      onRescanVault,
    });

    expect(readSource).toHaveBeenCalledWith("/vault/note.md");
    expect(writeSource).toHaveBeenCalledWith(
      "/vault/note.md",
      ["Intro", "#card", "Task line 1", "Task line 2", "#endcard", "Outro"].join("\n"),
    );
    expect(onSourceUpdated).toHaveBeenCalledWith({
      scope,
      contents: ["Intro", "#card", "Task line 1", "Task line 2", "#endcard", "Outro"].join(
        "\n",
      ),
      wroteFile: true,
    });
    expect(onRescanVault).toHaveBeenCalledTimes(1);
    expect(result.wroteFile).toBe(true);
    expect(result.rescanOk).toBe(true);
  });

  it("treats missing wrapper as no-op when remove policy is noop", async () => {
    const scope = {
      sourcePath: "/vault/note.md",
      sourceRange: {
        startLine: 1,
        endLine: 3,
      },
    };
    const source = ["Intro", "Task line 1", "Task line 2", "Outro"].join("\n");
    const readSource = vi.fn().mockResolvedValue(source);
    const writeSource = vi.fn().mockResolvedValue(undefined);
    const onSourceUpdated = vi.fn();

    const result = await applyTaskAreaToggle({
      scope,
      nextEnabled: false,
      removeMissingWrapperPolicy: "noop",
      mutators: {
        findWrapper: () => null,
        addWrapper: (lines) => ({
          lines,
          delta: 0,
          changed: false,
        }),
        removeWrapper: vi.fn(),
      },
      readSource,
      writeSource,
      onSourceUpdated,
    });

    expect(readSource).toHaveBeenCalledWith("/vault/note.md");
    expect(writeSource).not.toHaveBeenCalled();
    expect(onSourceUpdated).toHaveBeenCalledWith({
      scope,
      contents: source,
      wroteFile: false,
    });
    expect(result.wroteFile).toBe(false);
    expect(result.rescanOk).toBe(true);
  });

  it("keeps default remove behavior as error when wrapper is missing", async () => {
    const scope = {
      sourcePath: "/vault/note.md",
      sourceRange: {
        startLine: 1,
        endLine: 3,
      },
    };

    await expect(
      applyTaskAreaToggle({
        scope,
        nextEnabled: false,
        mutators: {
          findWrapper: () => null,
          addWrapper: (lines) => ({
            lines,
            delta: 0,
            changed: false,
          }),
          removeWrapper: (lines) => ({
            lines,
            delta: 0,
            changed: false,
          }),
        },
        readSource: vi
          .fn()
          .mockResolvedValue(["Intro", "Task line 1", "Task line 2", "Outro"].join("\n")),
        writeSource: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow("Could not identify an exact #card/#endcard wrapper");
  });
});
