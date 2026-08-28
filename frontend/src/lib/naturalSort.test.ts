import { describe, expect, it } from "vitest";
import { compareNaturalPath, compareNaturalText } from "./naturalSort";

describe("naturalSort", () => {
  it("orders numeric chunks naturally", () => {
    const values = ["10", "2", "1"].sort(compareNaturalText);
    expect(values).toEqual(["1", "2", "10"]);
  });

  it("orders dotted numeric sections naturally", () => {
    const values = ["2.10", "2.2", "2.1"].sort(compareNaturalText);
    expect(values).toEqual(["2.1", "2.2", "2.10"]);
  });

  it("compares case-insensitively for primary ordering", () => {
    expect(compareNaturalText("A2", "a10")).toBeLessThan(0);
  });

  it("normalizes path separators before compare", () => {
    expect(compareNaturalPath("folder\\2\\Note.md", "folder/10/Note.md")).toBeLessThan(0);
  });
});
