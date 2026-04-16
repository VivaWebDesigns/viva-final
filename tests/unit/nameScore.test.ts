import { describe, it, expect } from "vitest";
import { scoreHispanicName } from "../../server/features/marketplace/nameScore";

const PASS_THRESHOLD = 70;
const SURNAME_SCORE = 70;
const FIRST_NAME_SCORE = 25;

describe("scoreHispanicName — required pass list", () => {
  const shouldPass: Array<[string, string]> = [
    ["Jose Henriquez",    "exact: henriquez (+70) + jose (+25) = 95"],
    ["Jose Enriquez",     "exact: enriquez (+70) + jose (+25) = 95"],
    ["Maria Gutierrez",   "exact: gutierrez (+70) + maria (+25) = 95"],
    ["Juan Martinez",     "exact: martinez (+70) + juan (+25) = 95"],
    ["Luis Rodriguez",    "exact: rodriguez (+70) + luis (+25) = 95"],
    ["Ana Navarro",       "exact: navarro (+70) + ana (+25) = 95"],
    ["Carlos Santiago",   "exact: santiago (+70) + carlos (+25) = 95"],
    ["Armando Valverde",  "exact: valverde (+70) + armando (+25) = 95"],
    // Previously failing — now covered by data expansion + new strategies
    ["Marie Nail",             "data: nail in surnames (+70) + marie in first names (+25) = 95"],
    ["Carlos Camilo",          "data: camilo in surnames (+70) + carlos (+25) = 95"],
    ["Edward Ramirez Jr.",     "suffix strip: jr removed → ramirez (+70) + edward via bridge (+25) = 95"],
    ["Leonel Quintanilla Turcios", "data: turcios in surnames (+70) + leonel (+25) = 95"],
    ["Sergio Vidal",           "data: vidal in surnames (+70) + sergio (+25) = 95"],
    ["Edwin Cal",              "data: cal in surnames (+70) + edwin (+25) = 95"],
    ["Nelson Henrriquez",      "fuzzy: henrriquez ≈ henriquez (+70) + nelson (+25) = 95"],
  ];

  for (const [name, reason] of shouldPass) {
    it(`passes: ${name} — ${reason}`, () => {
      const result = scoreHispanicName(name);
      expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
      expect(result.spanishOutreachRecommended).toBe(true);
    });
  }
});

describe("scoreHispanicName — suffix stripping", () => {
  it("strips Jr. so it does not become the last name", () => {
    const result = scoreHispanicName("Edward Ramirez Jr.");
    expect(result.lastName).toBe("ramirez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  it("strips Sr. correctly", () => {
    const result = scoreHispanicName("Jose Martinez Sr.");
    expect(result.lastName).toBe("martinez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  it("strips II correctly", () => {
    const result = scoreHispanicName("Carlos Reyes II");
    expect(result.lastName).toBe("reyes");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });
});

describe("scoreHispanicName — anglicized first-name bridge", () => {
  it("Bob → Roberto (bridge) + Ramirez (+70) passes and generates note", () => {
    // "bob" is not in HISPANIC_FIRST_NAMES directly so it goes through the bridge
    const result = scoreHispanicName("Bob Ramirez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(true);
    expect(result.matchNotes.some((n) => n.includes("anglicized"))).toBe(true);
  });

  it("Henry → Enrique (bridge) + Lopez (+70) passes", () => {
    const result = scoreHispanicName("Henry Lopez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  it("William → Guillermo (bridge) + Garcia (+70) passes", () => {
    const result = scoreHispanicName("William Garcia");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  it("anglicized first name alone (no recognized surname) does NOT pass", () => {
    // bob→roberto (+25 bridge), Johnson = no match (+0) → 25 < 70
    const result = scoreHispanicName("Bob Johnson");
    expect(result.spanishOutreachRecommended).toBe(false);
  });
});

describe("scoreHispanicName — fuzzy surname matching", () => {
  it("Henrriquez (double r) passes — now an exact match in the dataset", () => {
    // henrriquez was explicitly added to the surnames list as a known spelling variant
    const result = scoreHispanicName("Nelson Henrriquez");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(true);
  });

  it("Martinezz (one extra letter) fuzzy-matches Martinez and generates a note", () => {
    // martinezz is NOT in the list → goes through fuzzy path → note generated
    const result = scoreHispanicName("Juan Martinezz");
    expect(result.hispanicNameScore).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(result.matchNotes.some((n) => n.includes("fuzzy"))).toBe(true);
  });

  it("completely unrelated surname does not fuzzy-match", () => {
    // Neither "todd" nor "johnson" are in any list or bridge
    const result = scoreHispanicName("Todd Johnson");
    expect(result.hispanicNameScore).toBe(0);
    expect(result.spanishOutreachRecommended).toBe(false);
  });
});

describe("scoreHispanicName — recognized Hispanic surname alone passes", () => {
  // "Todd" is not in any list or bridge table — surname score only
  const surnameOnly: Array<[string, string]> = [
    ["Todd Santiago",   "santiago (+70) + todd (+0) = 70"],
    ["Todd Escobar",    "escobar (+70) + todd (+0) = 70"],
    ["Todd Dominguez",  "dominguez (+70) + todd (+0) = 70"],
    ["Todd Valdez",     "valdez (+70) + todd (+0) = 70"],
    ["Todd Villalobos", "villalobos (+70) + todd (+0) = 70"],
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

describe("scoreHispanicName — Central American & Caribbean name coverage", () => {
  const regionalCases: Array<[string, string]> = [
    // Central America – one representative per country
    ["Iris Recinos",       "Guatemala: recinos (+70) + iris (+25) = 95"],
    ["Kimberly Turcios",   "Honduras: turcios (+70) + kimberly (+25) = 95"],
    ["Wilber Vasquez",     "El Salvador: vasquez (+70) + wilber (+25) = 95"],
    ["Bayardo Rivas",      "Nicaragua: rivas (+70) + bayardo (+25) = 95"],
    ["Fabricio Salazar",   "Costa Rica: salazar (+70) + fabricio (+25) = 95"],
    ["Griselda Medina",    "Panama: medina (+70) + griselda (+25) = 95"],
    // Caribbean – female and male representatives per country
    ["Ileana Batista",     "Cuba (female): batista (+70) + ileana (+25) = 95"],
    ["Ariel Batista",      "Cuba (male): batista (+70) + ariel (+25) = 95"],
    ["Altagracia Feliz",   "Dominican Republic (female): feliz (+70) + altagracia (+25) = 95"],
    ["Domingo Feliz",      "Dominican Republic (male): feliz (+70) + domingo (+25) = 95"],
    ["Odalis Colon",       "Puerto Rico (female): colon (+70) + odalis (+25) = 95"],
  ];

  for (const [name, reason] of regionalCases) {
    it(`scores ≥ 95: ${name} — ${reason}`, () => {
      const result = scoreHispanicName(name);
      expect(result.hispanicNameScore).toBeGreaterThanOrEqual(95);
      expect(result.spanishOutreachRecommended).toBe(true);
    });
  }
});

describe("scoreHispanicName — South American sub-regional name coverage", () => {
  const southAmericaCases: Array<[string, string]> = [
    // Paraguay – Guaraní-influenced / locally common given names
    ["Mirna Cardozo",    "Paraguay (female): cardozo (+70) + mirna (+25) = 95"],
    // Bolivia – Andean / indigenous-heritage community names
    ["Lidia Mamani",     "Bolivia (female): mamani (+70) + lidia (+25) = 95"],
    // Ecuador – coastal and highland Ecuador names
    ["Tatiana Suarez",   "Ecuador (female): suarez (+70) + tatiana (+25) = 95"],
  ];

  for (const [name, reason] of southAmericaCases) {
    it(`scores ≥ 95: ${name} — ${reason}`, () => {
      const result = scoreHispanicName(name);
      expect(result.hispanicNameScore).toBeGreaterThanOrEqual(95);
      expect(result.spanishOutreachRecommended).toBe(true);
    });
  }
});

describe("scoreHispanicName — Caribbean & Central American surname-only coverage (Task #51)", () => {
  // Each entry uses "Todd" as the first name (not in any list or bridge table)
  // so the score is driven solely by the recognised surname (+70 = pass threshold).
  const surnameOnlyCases: Array<[string, string]> = [
    // Honduras
    ["Todd Banegas",    "Honduras: banegas (+70) + todd (+0) = 70"],
    ["Todd Bustillo",   "Honduras: bustillo (+70) + todd (+0) = 70"],
    ["Todd Coello",     "Honduras: coello (+70) + todd (+0) = 70"],
    ["Todd Espinal",    "Honduras/DR: espinal (+70) + todd (+0) = 70"],
    ["Todd Euceda",     "Honduras: euceda (+70) + todd (+0) = 70"],
    ["Todd Funez",      "Honduras: funez (+70) + todd (+0) = 70"],
    ["Todd Guifarro",   "Honduras: guifarro (+70) + todd (+0) = 70"],
    ["Todd Interiano",  "Honduras/El Salvador: interiano (+70) + todd (+0) = 70"],
    ["Todd Murillo",    "Honduras: murillo (+70) + todd (+0) = 70"],
    ["Todd Reconco",    "Honduras: reconco (+70) + todd (+0) = 70"],
    ["Todd Sabillon",   "Honduras: sabillon (+70) + todd (+0) = 70"],
    ["Todd Suazo",      "Honduras: suazo (+70) + todd (+0) = 70"],
    ["Todd Valladares", "Honduras: valladares (+70) + todd (+0) = 70"],
    // El Salvador
    ["Todd Alvarenga",  "El Salvador: alvarenga (+70) + todd (+0) = 70"],
    ["Todd Baires",     "El Salvador: baires (+70) + todd (+0) = 70"],
    ["Todd Jovel",      "El Salvador: jovel (+70) + todd (+0) = 70"],
    ["Todd Magana",     "El Salvador: magana (+70) + todd (+0) = 70"],
    ["Todd Melara",     "El Salvador: melara (+70) + todd (+0) = 70"],
    ["Todd Pacas",      "El Salvador: pacas (+70) + todd (+0) = 70"],
    // Guatemala
    ["Todd Osorio",     "Guatemala: osorio (+70) + todd (+0) = 70"],
    // Nicaragua
    ["Todd Arauz",      "Nicaragua: arauz (+70) + todd (+0) = 70"],
    ["Todd Blandon",    "Nicaragua: blandon (+70) + todd (+0) = 70"],
    ["Todd Calero",     "Nicaragua: calero (+70) + todd (+0) = 70"],
    ["Todd Chavarria",  "Nicaragua: chavarria (+70) + todd (+0) = 70"],
    ["Todd Lanzas",     "Nicaragua: lanzas (+70) + todd (+0) = 70"],
    ["Todd Munguia",    "Nicaragua: munguia (+70) + todd (+0) = 70"],
    ["Todd Rugama",     "Nicaragua: rugama (+70) + todd (+0) = 70"],
    ["Todd Tellez",     "Nicaragua: tellez (+70) + todd (+0) = 70"],
    ["Todd Vallejos",   "Nicaragua: vallejos (+70) + todd (+0) = 70"],
    // Dominican Republic
    ["Todd Mercedes",   "Dominican Republic: mercedes (+70) + todd (+0) = 70"],
    ["Todd Novas",      "Dominican Republic: novas (+70) + todd (+0) = 70"],
    ["Todd Payano",     "Dominican Republic: payano (+70) + todd (+0) = 70"],
    // Puerto Rico
    ["Todd Nieves",     "Puerto Rico: nieves (+70) + todd (+0) = 70"],
    ["Todd Pagan",      "Puerto Rico: pagan (+70) + todd (+0) = 70"],
  ];

  for (const [name, reason] of surnameOnlyCases) {
    it(`surname alone passes at exactly 70: ${name} — ${reason}`, () => {
      const result = scoreHispanicName(name);
      expect(result.hispanicNameScore).toBe(SURNAME_SCORE);
      expect(result.spanishOutreachRecommended).toBe(true);
    });
  }
});

describe("scoreHispanicName — non-Hispanic names score 0", () => {
  it("Todd Johnson scores 0 (neither name in any list or bridge)", () => {
    const result = scoreHispanicName("Todd Johnson");
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
    // "Todd" is not in any list or bridge → 0; Navarro in surnames → +70 = exactly 70
    const result = scoreHispanicName("Todd Navarro");
    expect(result.hispanicNameScore).toBe(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(true);
  });

  it("score below threshold sets spanishOutreachRecommended false", () => {
    const result = scoreHispanicName("Todd Johnson");
    expect(result.hispanicNameScore).toBeLessThan(PASS_THRESHOLD);
    expect(result.spanishOutreachRecommended).toBe(false);
  });

  it("surname + first name score is capped at 100", () => {
    const result = scoreHispanicName("Jose Rodriguez");
    expect(result.hispanicNameScore).toBe(Math.min(100, SURNAME_SCORE + FIRST_NAME_SCORE));
  });
});

describe("scoreHispanicName — fuzzy first-name matching", () => {
  it("Vinycius Silva — 'Vinycius' is distance 1 from 'Vinicius', scores 95 (70 surname + 25 first)", () => {
    const result = scoreHispanicName("Vinycius Silva");
    expect(result.hispanicNameScore).toBe(95);
    expect(result.matchNotes.some((n) => n.includes("fuzzy") && n.includes("first name"))).toBe(true);
  });

  it("Beatris Santos — 'Beatris' is distance 1 from 'Beatriz', scores 95 (70 surname + 25 first)", () => {
    const result = scoreHispanicName("Beatris Santos");
    expect(result.hispanicNameScore).toBe(95);
    expect(result.matchNotes.some((n) => n.includes("fuzzy") && n.includes("first name"))).toBe(true);
  });

  it("Rafaell Pereira — 'Rafaell' is distance 1 from 'Rafael', scores 95 (70 surname + 25 first)", () => {
    const result = scoreHispanicName("Rafaell Pereira");
    expect(result.hispanicNameScore).toBe(95);
    expect(result.matchNotes.some((n) => n.includes("fuzzy") && n.includes("first name"))).toBe(true);
  });

  it("Fernanda Lopez — exact first-name match is unaffected by fuzzy logic, scores 95", () => {
    const result = scoreHispanicName("Fernanda Lopez");
    expect(result.hispanicNameScore).toBe(95);
    expect(result.matchNotes.every((n) => !n.includes("first name"))).toBe(true);
  });

  it("Todd Johnson — unrelated first name does not fuzzy-match any Hispanic first name, scores 0", () => {
    const result = scoreHispanicName("Todd Johnson");
    expect(result.hispanicNameScore).toBe(0);
  });

  it("Beatryzz Santos — distance-2 first name receives partial credit (15 pts), total 85 (70 + 15)", () => {
    // 'beatryzz' (8 chars, threshold 2) → distance 2 from 'beatriz' (y→i, extra z) → 15 pts
    const result = scoreHispanicName("Beatryzz Santos");
    expect(result.hispanicNameScore).toBe(85);
    expect(result.matchNotes.some((n) => n.includes("first name") && n.includes("edit distance 2"))).toBe(true);
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
