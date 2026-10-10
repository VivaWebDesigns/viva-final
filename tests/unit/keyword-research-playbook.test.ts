import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RankedKeyword } from "../../server/features/keyword-research/dataforseo";
import { serviceMatcher } from "../../server/features/keyword-research/keywords";
import { competitorProfile, competitorSearches, localize, placeIndex, yearOverYear } from "../../server/features/keyword-research/playbook";
import { kkcGlass } from "../fixtures/keyword-research/kkcGlass";

const fixtures = path.resolve(import.meta.dirname, "../fixtures/keyword-research");
const cities = (JSON.parse(readFileSync(path.join(fixtures, "cityNames.json"), "utf8")) as { cities: string[] }).cities;
const ranked = (domain: string) => (JSON.parse(readFileSync(path.join(fixtures, `kkc-glass/ranked-${domain}.json`), "utf8")) as { rows: RankedKeyword[] }).rows;
const { client } = kkcGlass;
const index = placeIndex(cities, [...client.services, client.trade], ["matthews", "charlotte", "concord"]);

describe("localizing competitor keywords", () => {
  it.each([
    ["window replacement raleigh nc", "", "window replacement"],
    ["glass companies in raleigh nc", "", "glass companies"],
    ["glass rock hill sc", "", "glass"],
    ["window repair chicago", "https://argowindowrepair.com/illinois/window-repair-chicago", "window repair"],
    ["shower door installation near me", "", "shower door installation"],
    ["glass shower doors matthews", "", "glass shower doors"],
    ["window repair north carolina", "", "window repair"],
  ])("%s → %s", (keyword, url, head) => {
    expect(localize(keyword, index, url).head).toBe(head);
  });

  it.each([
    // Towns that are everyday words or brands: Between GA, Wall SD, Home PA, Price UT, Pella IA.
    ["mold between window panes", "https://argowindowrepair.com/blog/glass/how-do-you-get-rid-of-mold-between-window-panes"],
    ["fix glass wall", "https://glasssolutionsnc.com/durham/commercial/interior-glass-wall/"],
    ["best home window", "https://argowindowrepair.com/blog/window/best-window-brands"],
    ["window screen repair price", ""],
    ["pella windows repair", "https://argowindowrepair.com/pella-window-repair"],
    ["glass wall in bathroom", "https://myshowerdoor.com/stationary-glass-panels/"],
  ])("leaves %s alone", (keyword, url) => {
    expect(localize(keyword, index, url)).toEqual({ head: keyword, hadPlace: false });
  });

  it("strips a town without a state only when the ranking page is about it", () => {
    expect(localize("window repair chicago", index, "https://argowindowrepair.com/blog/chicago-winters").head).toBe("window repair chicago");
    expect(localize("window repair chicago", index, "https://argowindowrepair.com/illinois/window-repair-chicago").hadPlace).toBe(true);
  });
});

describe("year over year", () => {
  const months = (volumes: number[], startYear = 2024, startMonth = 9) => volumes.map((volume, offset) => {
    const at = startYear * 12 + startMonth - 1 + offset;
    return { year: Math.floor(at / 12), month: (at % 12) + 1, volume };
  });
  const seasonal = [100, 120, 200, 300, 300, 200, 100, 80, 60, 60, 80, 90];

  it("is flat for the same seasonal curve two years running", () => {
    expect(yearOverYear(months([...seasonal, ...seasonal]))).toBe(0);
  });

  it("measures growth against the same months a year earlier", () => {
    expect(yearOverYear(months([...seasonal, ...seasonal.map(volume => volume * 1.5)]))).toBe(0.5);
  });

  it("returns nothing for too little history or too few searches", () => {
    expect(yearOverYear(months(seasonal))).toBeNull();
    expect(yearOverYear(months(Array(24).fill(10)))).toBeNull();
  });
});

describe("competitor profile", () => {
  it("reads Argo's playbook: city folders and about a fifth of its value on the blog", () => {
    const profile = competitorProfile("argowindowrepair.com", ranked("argowindowrepair.com"));
    expect(profile.topFolders[0].folder).toBe("/blog");
    expect(profile.topFolders.map(folder => folder.folder)).toContain("/maryland");
    expect(profile.blogValueShare).toBeGreaterThan(0.1);
    expect(profile.blogValueShare).toBeLessThan(0.4);
  });
});

// Replays the saved benchmark rankings and checks the reviewed gaps come out the other end.
describe("KKC Glass playbook", () => {
  const searches = competitorSearches(new Map(["argowindowrepair.com", "myshowerdoor.com", "glasssolutionsnc.com"].map(domain => [domain, ranked(domain)])), index);
  const match = serviceMatcher({ services: [...client.services], trade: client.trade, city: client.city, state: client.state });

  it("turns the benchmarks' city keywords into searches KKC can target", () => {
    for (const keyword of kkcGlass.expectedGapKeywords) expect(searches.has(keyword), keyword).toBe(true);
    expect(searches.get("window glass replacement")?.competitors.map(entry => entry.domain)).toContain("argowindowrepair.com");
  });

  it("merges the same search from different cities into one", () => {
    const companies = searches.get("glass companies");
    expect(companies?.hadPlace).toBe(true);
    expect([...searches.keys()].filter(head => head.startsWith("glass companies in"))).toEqual([]);
  });

  it("never matches a windshield or auto glass search to one of KKC's services by wording", () => {
    const offService = [...searches.keys()].filter(head => kkcGlass.mustNotRecommend.some(pattern => pattern.test(head)));
    expect(offService.length).toBeGreaterThan(0);
    for (const head of offService) expect(match(head).service, head).toBeNull();
  });
});
