import { describe, expect, it } from "vitest";
import { parseSalesPriority } from "@shared/salesPriority";

describe("parseSalesPriority", () => {
  it.each([
    [1, 1],
    ["2", 2],
    [3, 3],
  ])("accepts supported priority %s", (input, expected) => {
    expect(parseSalesPriority(input)).toBe(expected);
  });

  it.each([null, undefined, "", 0, 4, "high"])("rejects unsupported priority %s", (input) => {
    expect(parseSalesPriority(input)).toBeNull();
  });
});
