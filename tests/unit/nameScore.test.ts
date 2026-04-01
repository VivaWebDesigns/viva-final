import { describe, it, expect } from "vitest";
import { scoreHispanicName } from "../../server/features/marketplace/nameScore";

const PASS_THRESHOLD = 70;
const SURNAME_SCORE = 70;
const FIRST_NAME_SCORE = 25;

describe("scoreHispanicName — required pass list", () => {
  const shouldPass: Array<[string, string]> = [
    ["Jose Henriquez",    "henriquez (+70) + jose (+25) = 95"],
    ["Jose Enriquez",     "enriquez (+70) + jose (+25) = 95"],
    ["Maria Gutierrez",   "gutierrez (+70) + maria (+25) = 95"],
    ["Juan Martinez",     "martinez (+70) + juan (+25) = 95"],
    ["Luis Rodriguez",    "rodriguez (+70) + luis (+25) = 95"],
    ["Ana Navarro",       "navarro (+70) + ana (+25) = 95"],
    ["Carlos Santiago",   "santiago (+70) + carlos (+25) = 95"],
    ["Armando Valverde",  "valverde (+70) + armando (+25) = 95"],
  ];

  for (const [name, reason] of shouldPass) {
    it(`passes: ${name} — ${reason}`, () => {
      const result = scoreHispanicName(name);
      expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
      expect(result.spanishOutreachRecommended).toBe(true);
    });
  }
});

describe("scoreHispanicName — recognized Hispanic surname alone passes", () => {
  // Non-Hispanic first name + Hispanic surname: last name alone carries the score.
  const surnameOnly: Array<[string, string]> = [
    ["Bob Santiago",   "santiago (+70) + bob (+0) = 70"],
    ["Bob Escobar",    "escobar (+70) + bob (+0) = 70"],
    ["Bob Dominguez",  "dominguez (+70) + bob (+0) = 70"],
    ["Bob Valdez",     "valdez (+70) + bob (+0) = 70"],
    ["Bob Villalobos", "villalobos (+70) + bob (+0) = 70"],
  ];

  for (const [name, reason] of surnameOnly) {
    it(`surname alone passes: ${name} — ${reason}`, () => {
      const result = scoreHispanicName(name);
      expect(result.hispanicNameScore).toBe(SURNAME_SCORE);
      expect(result.spanishOutreachRecommended).toBe(true);
    });
  }
});

describe("scoreHispanicName — Hispanic first name alone does NOT pass", () => {
  it("Jose (single token, no last name) scores first-name only and is blocked", () => {
    const result = scoreHispanicName("Jose");
    expect(result.hispanicNameScore).toBe(FIRST_NAME_SCORE);
    expect(result.spanishOutreachRecommended).toBe(false);
  });

  it("Maria (single token) scores first-name only and is blocked", () => {
    const result = scoreHispanicName("Maria");
    expect(result.hispanicNameScore).toBe(FIRST_NAME_SCORE);
    expect(result.spanishOutreachRecommended).toBe(false);
  });
});

describe("scoreHispanicName — non-Hispanic names score 0", () => {
  it("Bob Johnson scores 0 (neither name recognized)", () => {
    const result = scoreHispanicName("Bob Johnson");
    expect(result.hispanicNameScore).toBe(0);
    expect(result.spanishOutreachRecommended).toBe(false);
  });

  it("single unrecognized token scores 0", () => {
    const result = scoreHispanicName("Smith");
    expect(result.hispanicNameScore).toBe(0);
    expect(result.spanishOutreachRecommended).toBe(false);
  });
});

describe("scoreHispanicName — threshold alignment", () => {
  it("score exactly at threshold (70) sets spanishOutreachRecommended true", () => {
    // Bob = not in first names (+0); Navarro = in surnames (+70) → exactly 70
    const result = scoreHispanicName("Bob Navarro");
    expect(result.hispanicNameScore).toBe(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(true);
  });

  it("score below threshold (0) sets spanishOutreachRecommended false", () => {
    const result = scoreHispanicName("Bob Johnson");
    expect(result.hispanicNameScore).toBeLessThan(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(false);
  });

  it("surname + first name score is capped at 100", () => {
    const result = scoreHispanicName("Jose Rodriguez");
    expect(result.hispanicNameScore).toBe(Math.min(100, SURNAME_SCORE + FIRST_NAME_SCORE));
  });
});

describe("scoreHispanicName — normalization", () => {
  it("strips accented characters (José Rodríguez)", () => {
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

  it("compound names use first token as firstName, last token as lastName", () => {
    const result = scoreHispanicName("Juan Carlos Martinez Lopez");
    expect(result.firstName).toBe("juan");
    expect(result.lastName).toBe("lopez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });
});
