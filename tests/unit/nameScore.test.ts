import { describe, it, expect } from "vitest";
import { scoreHispanicName } from "../../server/features/marketplace/nameScore";

const PASS_THRESHOLD = 70;

describe("scoreHispanicName — required pass list", () => {
  const shouldPass: Array<[string, string]> = [
    ["Jose Henriquez",  "henriquez in Tier 1 (+70) + jose in first names (+25) = 95"],
    ["Jose Enriquez",   "enriquez in Tier 1 (+70) + jose in first names (+25) = 95"],
    ["Maria Gutierrez", "gutierrez in Tier 1 (+70) + maria in first names (+25) = 95"],
    ["Juan Martinez",   "martinez in Tier 1 (+70) + juan in first names (+25) = 95"],
    ["Luis Rodriguez",  "rodriguez in Tier 1 (+70) + luis in first names (+25) = 95"],
    ["Ana Navarro",     "navarro in Tier 1 (+70) + ana not in first names (+0) = 70"],
    ["Carlos Santiago", "santiago in Tier 2 (+50) + carlos in first names (+25) = 75"],
  ];

  for (const [name, reason] of shouldPass) {
    it(`passes: ${name} — ${reason}`, () => {
      const result = scoreHispanicName(name);
      expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
      expect(result.spanishOutreachRecommended).toBe(true);
    });
  }
});

describe("scoreHispanicName — reject cases", () => {
  it("scores 0 for a clearly non-Hispanic name (Bob Johnson)", () => {
    const result = scoreHispanicName("Bob Johnson");
    expect(result.hispanicNameScore).toBe(0);
    expect(result.spanishOutreachRecommended).toBe(false);
  });

  it("scores 0 for an empty-ish single-token input", () => {
    const result = scoreHispanicName("Smith");
    expect(result.hispanicNameScore).toBe(0);
    expect(result.spanishOutreachRecommended).toBe(false);
  });
});

describe("scoreHispanicName — threshold alignment", () => {
  it("spanishOutreachRecommended is true when score equals threshold exactly", () => {
    const result = scoreHispanicName("Ana Navarro");
    expect(result.hispanicNameScore).toBe(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(true);
  });

  it("spanishOutreachRecommended is false when score is below threshold", () => {
    const result = scoreHispanicName("Bob Johnson");
    expect(result.hispanicNameScore).toBeLessThan(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(false);
  });
});

describe("scoreHispanicName — normalization", () => {
  it("handles accented characters correctly (José Rodríguez)", () => {
    const result = scoreHispanicName("José Rodríguez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(result.firstName).toBe("jose");
    expect(result.lastName).toBe("rodriguez");
  });

  it("is case-insensitive (JUAN MARTINEZ)", () => {
    const result = scoreHispanicName("JUAN MARTINEZ");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  it("trims extra whitespace", () => {
    const result = scoreHispanicName("  Juan   Martinez  ");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  it("handles compound names — uses first token as firstName, last token as lastName", () => {
    const result = scoreHispanicName("Juan Carlos Martinez Lopez");
    expect(result.firstName).toBe("juan");
    expect(result.lastName).toBe("lopez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });
});
