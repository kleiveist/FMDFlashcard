import { describe, expect, it } from "vitest";
import {
  applyDatabaseTableLayoutOrder,
  buildDatabaseTableLayoutKey,
  normalizeDatabaseTableLayoutProfile,
  readDatabaseTableLayoutProfile,
  resolveDatabaseTableLayoutProfilePath,
  writeDatabaseTableLayoutProfile,
} from "./database-table-layout-profile";

describe("database-table-layout-profile", () => {
  it("builds stable table layout keys per source block and view", () => {
    const first = buildDatabaseTableLayoutKey({
      sourceRelativePath: "notes/a.md",
      blockIndex: 1,
      viewId: "view-a",
    });
    const second = buildDatabaseTableLayoutKey({
      sourceRelativePath: "notes/a.md",
      blockIndex: 1,
      viewId: "view-a",
    });
    const otherView = buildDatabaseTableLayoutKey({
      sourceRelativePath: "notes/a.md",
      blockIndex: 1,
      viewId: "view-b",
    });

    expect(first).toBe(second);
    expect(first).not.toBe(otherView);
  });

  it("orders known columns from a saved layout and appends new columns", () => {
    const columns = [{ key: "Task" }, { key: "Status" }, { key: "Owner" }];

    expect(
      applyDatabaseTableLayoutOrder(columns, {
        columnOrder: ["Owner", "Task"],
        columnWidths: {},
      }).map((entry) => entry.key),
    ).toEqual(["Owner", "Task", "Status"]);
  });

  it("normalizes duplicate column order entries and unsafe widths", () => {
    expect(
      normalizeDatabaseTableLayoutProfile({
        columnOrder: ["", "Task", "task", "Status"],
        columnWidths: {
          Task: 40,
          Status: 700,
          Owner: "205",
          Empty: Number.NaN,
        },
      }),
    ).toEqual({
      columnOrder: ["Task", "Status"],
      columnWidths: {
        Task: 96,
        Status: 640,
        Owner: 205,
      },
    });
  });

  it("roundtrips layout data in the vault profile file", async () => {
    let storedJson = "";
    const writes: Array<{ path: string; contents: string }> = [];
    const io = {
      readJsonFile: async (_path: string) => {
        if (!storedJson) {
          throw new Error("File not found.");
        }
        return storedJson;
      },
      writeJsonFile: async (path: string, contents: string) => {
        storedJson = contents;
        writes.push({ path, contents });
      },
    };

    await writeDatabaseTableLayoutProfile(
      "/vault",
      "layout-a",
      {
        columnOrder: ["Task", "Status"],
        columnWidths: {
          Task: 220,
          Status: 160,
        },
      },
      io,
    );

    expect(writes[0]?.path).toBe(resolveDatabaseTableLayoutProfilePath("/vault"));
    await expect(readDatabaseTableLayoutProfile("/vault", "layout-a", io)).resolves.toEqual({
      columnOrder: ["Task", "Status"],
      columnWidths: {
        Task: 220,
        Status: 160,
      },
    });
  });
});
