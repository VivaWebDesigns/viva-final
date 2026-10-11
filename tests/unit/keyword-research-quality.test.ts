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

// Raw Google Ads numbers from the 2026-10-10 benchmark (Charlotte NC DMA 200517, Sep 2025 – Aug 2026).
describe("grouping keeps every phrase's own measurements", () => {
  const ads = (keyword: string, searchVolume: number | null, cpc: number | null, low: number | null, high: number | null, competition: string | null): KeywordMetrics =>
    ({ keyword, searchVolume, cpc, competition, competitionIndex: null, lowTopOfPageBid: low, highTopOfPageBid: high });
  const rows = [
    ads("glass shower door installation", 30, 32.4, 3.48, 23.22, "HIGH"),
    ads("installing glass shower doors", 30, 32.4, 3.48, 23.22, "HIGH"),
    ads("glass shower door installation near me", 10, 134.86, 6.13, 25.09, "HIGH"),
  ];
  const input = { services: ["glass shower door installation"], trade: "glass company", city: "Charlotte", state: "NC" };

  it("keeps a phrase asked for by name as the row its numbers belong to, with the near me numbers beside it", () => {
    const { keywords } = buildKeywordList(rows, { ...input, exactPhrases: ["glass shower door installation"] });
    const row = find(keywords, "glass shower door installation")!;
    expect(row).toMatchObject({ searchVolume: 30, cpc: 32.4, lowTopOfPageBid: 3.48, highTopOfPageBid: 23.22, competition: "HIGH", nearMeVolume: 10, variants: ["installing glass shower doors"] });
    expect(row.variantMetrics).toEqual([expect.objectContaining({ keyword: "installing glass shower doors", searchVolume: 30, cpc: 32.4 })]);
    expect(row.nearMeMetrics).toEqual([expect.objectContaining({ keyword: "glass shower door installation near me", searchVolume: 10, cpc: 134.86, lowTopOfPageBid: 6.13, highTopOfPageBid: 25.09 })]);
    expect(find(keywords, "installing glass shower doors")).toBeUndefined();
  });

  it("folds near me into the phrasing a plain phrase was merged into, instead of recreating it from the near me numbers", () => {
    const { keywords } = buildKeywordList(rows, input);
    expect(keywords.map(row => row.keyword)).toEqual(["installing glass shower doors"]);
    expect(keywords[0]).toMatchObject({ searchVolume: 30, cpc: 32.4, lowTopOfPageBid: 3.48, highTopOfPageBid: 23.22, nearMeVolume: 10 });
  });

  it("never gives a plain phrase the CPC or bids of its near me phrasing", () => {
    const alone = foldNearMe(mergeCloseVariants([rows[2]]).rows).rows[0];
    expect(alone).toMatchObject({ keyword: "glass shower door installation", searchVolume: null, cpc: null, lowTopOfPageBid: null, highTopOfPageBid: null, competition: null, nearMeVolume: 10 });
    const noCpc = foldNearMe(mergeCloseVariants([ads("shower door repair", 20, null, null, null, null), ads("shower door repair near me", 40, 18.5, 4, 30, "HIGH")]).rows).rows[0];
    expect(noCpc).toMatchObject({ searchVolume: 20, cpc: null, lowTopOfPageBid: null, nearMeVolume: 40 });
  });

  it("leaves every kept row with exactly its own raw numbers across a real list", () => {
    const input2 = { services: ["shower doors", "central air installation", "drain cleaning"], trade: "home services", city: "Charlotte", state: "NC" };
    const raw = realRows.map(row => ({ ...metrics(row.keyword, row.searchVolume, row.cpc), lowTopOfPageBid: row.cpc == null ? null : row.cpc / 2 }));
    const own = new Map(raw.map(row => [row.keyword, row]));
    const { keywords } = buildKeywordList(raw, input2);
    expect(keywords.filter(row => row.nearMeVolume != null || row.variants?.length).length).toBeGreaterThanOrEqual(5);
    for (const row of keywords) {
      const source = own.get(row.keyword);
      expect([row.searchVolume, row.cpc, row.lowTopOfPageBid]).toEqual(source ? [source.searchVolume, source.cpc, source.lowTopOfPageBid] : [null, null, null]);
    }
  });
});

describe("retention", () => {
  it("keeps a service phrase whose numbers match an excluded phrase, instead of dropping it as that phrase's variant", () => {
    const ads = (keyword: string): KeywordMetrics => ({ keyword, searchVolume: 110, cpc: 9.5, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null });
    const { keywords, summary } = buildKeywordList([ads("window screen replacement"), ads("window sash replacement")], {
      services: ["window replacement"], trade: "glass company", city: "Charlotte", state: "NC",
      exclusions: [{ work: "screen repair", terms: ["screen replacement"], reason: "", source: "user" }],
    });
    expect(keywords.map(row => row.keyword)).toEqual(["window sash replacement"]);
    expect(keywords[0].variants).toEqual([]);
    expect(summary.droppedExcluded).toBe(1);
  });
});

describe("retention through grouping", () => {
  it("keeps a group under the phrasing that names a confirmed service, so a shorter unmatched phrasing cannot drop it", () => {
    const ads = (keyword: string): KeywordMetrics => ({ keyword, searchVolume: 110, cpc: 21.51, competition: "HIGH", competitionIndex: null, lowTopOfPageBid: 3.73, highTopOfPageBid: 19.04 });
    const { keywords } = buildKeywordList([ads("sash replacement"), ads("window sash replacement")], { services: ["window replacement"], trade: "glass company", city: "Charlotte", state: "NC" });
    expect(keywords).toEqual([expect.objectContaining({ keyword: "window sash replacement", service: "window replacement", searchVolume: 110, cpc: 21.51, variants: ["sash replacement"] })]);
  });
});

describe("combined demand", () => {
  const ads = (keyword: string, searchVolume: number | null, cpc: number | null): KeywordMetrics =>
    ({ keyword, searchVolume, cpc, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null });

  it("adds each distinct near me search once, never a grouped variant or a phrasing Google counts as the same search", () => {
    const { rows } = mergeCloseVariants([
      ads("window repair", 170, 21.25), ads("window repair near me", 590, 18.4), ads("window repairs near me", 590, 18.4),
      ads("window repair close to me", 40, 25.1), ads("window repair nearby", 170, 21.25),
    ]);
    const row = foldNearMe(rows).rows[0];
    expect(row.nearMeVolume).toBe(590 + 40);
    expect(totalDemand(row)).toBe(170 + 590 + 40);
    expect(row.nearMeMetrics?.filter(item => item.counted).map(item => item.keyword).sort()).toEqual(["window repair close to me", "window repair near me"]);
    expect(row.nearMeMetrics?.filter(item => !item.counted).map(item => item.keyword)).toEqual(["window repairs near me"]);
    // Same numbers as the plain phrase: Google's same search, merged as a variant and counted once.
    expect(row.variants).toEqual(["window repair nearby"]);
  });

  it("never counts a merged variant's volume: Google reports it as the same search", () => {
    const { keywords } = buildKeywordList([ads("door installation", 30, 51.97), ads("installing doors", 30, 51.97), ads("door installer", 20, 40)], { services: ["door installation"], trade: "glass company", city: "Charlotte", state: "NC", exactPhrases: ["door installation"] });
    expect(totalDemand(find(keywords, "door installation")!)).toBe(30);
    expect(totalDemand(find(keywords, "door installer")!)).toBe(20);
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

  it("keeps every candidate for a confirmed service with unknown or zero volume instead of treating it as zero", () => {
    const rows = [
      metrics("shower door installation matthews", null), metrics("shower door installation", 1000, 9), metrics("shower door installation charlotte", null),
      metrics("shower door installation pineville", 0), metrics("bathroom remodel ideas", null),
    ];
    const { keywords, summary } = buildKeywordList(rows, { ...input, exactPhrases: ["shower door installation matthews"] });
    expect(keywords.map(row => row.keyword)).toEqual([
      "shower door installation", "shower door installation charlotte", "shower door installation matthews", "shower door installation pineville",
    ]);
    expect(find(keywords, "shower door installation matthews")?.searchVolume).toBeNull();
    expect(find(keywords, "shower door installation pineville")?.searchVolume).toBe(0);
    // Only a keyword with no service and no searches is dropped.
    expect(summary).toMatchObject({ unknownVolume: 2, keptWithoutSearches: 3, droppedNoVolume: 1 });
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
