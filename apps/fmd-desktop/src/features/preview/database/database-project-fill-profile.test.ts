import { describe, expect, it } from "vitest";
import {
  applyProjectBarFillConfigToRecordIds,
  normalizeDatabaseProjectFillProfile,
  normalizeProjectBarFillConfigs,
  readDatabaseProjectFillProfile,
  resolveDatabaseProjectFillProfilePath,
  writeDatabaseProjectFillProfile,
} from "./database-project-fill-profile";

describe("database-project-fill-profile", () => {
  it("normalizes project fill configs without requiring editable attributes", () => {
    expect(normalizeProjectBarFillConfigs([
      {
        recordId: "record-a",
        attributeKey: "Progress",
        mode: "numeric",
        min: "0",
        max: "100",
      },
      {
        recordId: "record-b",
        attributeKey: "StatusCode",
        mode: "text-code",
        mappings: [
          { from: "text1", to: "10" },
          { from: "", to: 20 },
          { from: "text2", to: "bad" },
        ],
      },
      {
        recordId: "record-c",
        attributeKey: "",
        mode: "numeric",
      },
    ])).toEqual([
      {
        recordId: "record-a",
        attributeKey: "Progress",
        mode: "numeric",
        min: 0,
        max: 100,
      },
      {
        recordId: "record-b",
        attributeKey: "StatusCode",
        mode: "text-code",
        mappings: [{ from: "text1", to: 10 }],
      },
    ]);
  });

  it("applies a visual rule to record ids without changing attribute values", () => {
    const result = applyProjectBarFillConfigToRecordIds(
      [
        {
          recordId: "record-a",
          attributeKey: "OldProgress",
          mode: "numeric",
          min: 0,
          max: 50,
        },
      ],
      {
        recordId: "__template__",
        attributeKey: "FormulaProgress",
        mode: "numeric",
        min: 0,
        max: 100,
      },
      ["record-a", "record-b"],
    );

    expect(result).toEqual([
      {
        recordId: "record-a",
        attributeKey: "FormulaProgress",
        mode: "numeric",
        min: 0,
        max: 100,
      },
      {
        recordId: "record-b",
        attributeKey: "FormulaProgress",
        mode: "numeric",
        min: 0,
        max: 100,
      },
    ]);
  });

  it("roundtrips project fill rules in the vault profile file", async () => {
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

    await writeDatabaseProjectFillProfile("/vault", "project-a", {
      barFillConfigs: [
        {
          recordId: "record-a",
          attributeKey: "Progress",
          mode: "numeric",
          min: 0,
          max: 100,
        },
      ],
    }, io);

    expect(writes[0]?.path).toBe(resolveDatabaseProjectFillProfilePath("/vault"));
    await expect(readDatabaseProjectFillProfile("/vault", "project-a", io)).resolves.toEqual({
      barFillConfigs: [
        {
          recordId: "record-a",
          attributeKey: "Progress",
          mode: "numeric",
          min: 0,
          max: 100,
        },
      ],
    });
  });

  it("normalizes unknown profile payloads to an empty visual rule set", () => {
    expect(normalizeDatabaseProjectFillProfile({ invalid: true })).toEqual({
      barFillConfigs: [],
    });
  });
});
