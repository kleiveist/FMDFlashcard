import { describe, expect, it } from "vitest";
import { resolveSeed, seededShuffle } from "./seededShuffle";

describe("seeded shuffle helper", () => {
  it("produces a predictable permutation for a seed", () => {
    const tokens = ["a", "b", "c", "d"];
    const seed = resolveSeed("card:0");
    const first = seededShuffle(tokens, seed);
    expect(first).toEqual(["c", "b", "a", "d"]);
    expect(seededShuffle(tokens, seed)).toEqual(first);
  });

  it("produces different permutations for different seeds", () => {
    const tokens = ["a", "b", "c", "d"];
    const first = seededShuffle(tokens, resolveSeed("card:0"));
    const second = seededShuffle(tokens, resolveSeed("card:1"));
    expect(second).toEqual(["b", "c", "a", "d"]);
    expect(second).not.toEqual(first);
  });

  it("does not mutate the original token array", () => {
    const tokens = ["a", "b", "c", "d"];
    const snapshot = [...tokens];
    seededShuffle(tokens, resolveSeed("card:2"));
    expect(tokens).toEqual(snapshot);
  });
});
