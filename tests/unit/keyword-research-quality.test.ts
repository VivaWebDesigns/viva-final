import { describe, expect, it } from "vitest";
import type { KeywordMetrics } from "../../server/features/keyword-research/dataforseo";
import { buildKeywordList, serviceDemand, serviceVariants } from "../../server/features/keyword-research/keywords";
import { foldNearMe, headTerm, isNearMe, mergeCloseVariants, sameSearch, totalDemand } from "../../server/features/keyword-research/quality";
import { realRows } from "../fixtures/keyword-research/googleAdsRows";

const metrics = (keyword: string, searchVolume: number | null, cpc: number | null = null): KeywordMetrics => ({
  keyword, searchVolume, cpc, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null,
});
const real = (...keywords: string[]) => keywords.map(keyword => {
  const row = realRows.find(item => item.keyword === keyword);
  if (!row) throw new Error(`No fixture row for ${keyword}`);
  return metrics(row.keyword, row.searchVolume, row.cpc);
});
const find = (rows: Array<{ keyword: string }>, keyword: string) => rows.find(row => row.keyword === keyword);

describe("close variants", () => {
  it("merges the five phrasings Google reports as one central air search into the shortest", () => {
    const { rows, merged } = mergeCloseVariants(real(
      "central a c installation cost", "central ac installation cost", "cost to install central air",
      "cost to install central air conditioning", "price for central air installation",
    ));
    expect(merged).toBe(4);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("cost to install central air");
    expect(rows[0].variants).toHaveLength(4);
  });

  it("merges reworded and city-reordered pairs", () => {
    for (const pair of [
      ["ceiling fan repair", "fix a ceiling fan"],
      ["furnace replacement cost", "furnace replacement prices"],
      ["cottage grove mn plumbers", "plumbers in cottage grove mn"],
      ["glass shower doors images", "images of glass shower doors"],
    ]) expect(mergeCloseVariants(real(...pair)).rows).toHaveLength(1);
  });

  it("keeps unrelated keywords apart even when Google gives them identical numbers", () => {
    expect(mergeCloseVariants(real("ridge shingles", "how to turn up water pressure in house")).rows).toHaveLength(2);
    expect(mergeCloseVariants(real("solar maintenance cost", "how to wire a heat pump thermostat")).rows).toHaveLength(2);
  });

  it("errs toward keeping two rows when the wording barely overlaps", () => {
    // Google groups these, but merging on one shared word would also merge real coincidences.
    expect(mergeCloseVariants(real("clogged drain", "stopped up drain")).rows).toHaveLength(2);
  });

  it("never merges rows with an unknown volume or CPC", () => {
    expect(sameSearch(metrics("roof repair", null), metrics("roof repairs", null))).toBe(false);
    expect(sameSearch(metrics("roof repair", 90), metrics("roof repairs", 90))).toBe(false);
  });
});

describe("near me", () => {
  it("recognises near me phrasings and their plain phrase", () => {
    expect(isNearMe("Shower Door Company Near Me")).toBe(true);
    expect(isNearMe("shower door company")).toBe(false);
    expect(headTerm("shower door company near me")).toBe("shower door company");
  });

  it("folds near me volume into the plain phrase instead of keeping it as a target", () => {
    const { rows } = mergeCloseVariants(real("custom shower doors", "custom shower doors near me", "shower door company", "shower door company near me"));
    const folded = foldNearMe(rows);
    expect(folded.folded).toBe(2);
    expect(folded.rows.map(row => row.keyword).sort()).toEqual(["custom shower doors", "shower door company"]);
    expect(find(folded.rows, "custom shower doors")).toMatchObject({ searchVolume: 22200, nearMeVolume: 2400 });
    expect(totalDemand(find(folded.rows, "shower door company")!)).toBe(880 + 1600);
  });

  it("adds the plain phrase with unknown volume of its own when only the near me phrasing came back", () => {
    const folded = foldNearMe(mergeCloseVariants(real("custom glass shower enclosures near me")).rows);
    expect(folded.rows).toEqual([expect.objectContaining({ keyword: "custom glass shower enclosures", searchVolume: null, nearMeVolume: 70 })]);
  });

  it("counts three grouped near me phrasings once", () => {
    const { rows } = mergeCloseVariants(real("shower door showroom near me", "shower door showrooms near me", "shower doors showroom near me"));
    const folded = foldNearMe(rows);
    expect(folded.rows).toHaveLength(1);
    expect(folded.rows[0]).toMatchObject({ keyword: "shower door showroom", nearMeVolume: 260 });
  });

  it("adds nothing when Google grouped the near me phrasing with the plain phrase", () => {
    const folded = foldNearMe(mergeCloseVariants([metrics("glass repair", 590, 12.5), metrics("glass repair near me", 590, 12.5)]).rows);
    expect(folded.rows).toEqual([expect.objectContaining({ keyword: "glass repair", searchVolume: 590, nearMeVolume: null })]);
  });
});

describe("service demand", () => {
  it("counts a search Google grouped across phrasings once", () => {
    const volumes = new Map(serviceVariants("glass repair", "Matthews").map(keyword => [keyword, metrics(keyword, 590, 12.5)]));
    expect(serviceDemand("glass repair", "Matthews", volumes)).toBe(590);
  });

  it("adds phrasings Google counts separately", () => {
    const volumes = new Map([
      ["glass repair", metrics("glass repair", 590, 12.5)],
      ["glass repair near me", metrics("glass repair near me", 1300, 14.1)],
    ]);
    expect(serviceDemand("glass repair", "Matthews", volumes)).toBe(1890);
  });
});

describe("keyword list", () => {
  const input = { services: ["shower door installation"], trade: "glass", city: "Matthews", state: "NC" };

  it("keeps a requested service phrase with unknown volume instead of treating it as zero", () => {
    const rows = [metrics("shower door installation matthews", null), metrics("shower door installation", 1000, 9), metrics("shower door installation charlotte", null)];
    const { keywords, summary } = buildKeywordList(rows, { ...input, exactPhrases: ["shower door installation matthews"] });
    expect(keywords.map(row => row.keyword)).toEqual(["shower door installation", "shower door installation matthews"]);
    expect(find(keywords, "shower door installation matthews")?.searchVolume).toBeNull();
    expect(summary).toMatchObject({ unknownVolume: 1, droppedNoVolume: 1 });
  });

  it("merges variants and folds near me before sorting by total demand", () => {
    const rows = [
      metrics("shower door installation", 1000, 9),
      metrics("shower door installation near me", 1500, 11),
      metrics("shower door installer", 1200, 8),
      metrics("installation of shower doors", 1000, 9),
    ];
    const { keywords, summary } = buildKeywordList(rows, input);
    expect(keywords.map(row => row.keyword)).toEqual(["shower door installation", "shower door installer"]);
    expect(keywords[0]).toMatchObject({ nearMeVolume: 1500, variants: ["installation of shower doors"] });
    expect(summary).toMatchObject({ ideasReturned: 4, keptKeywords: 2, mergedVariants: 1, foldedNearMe: 1 });
  });
});
