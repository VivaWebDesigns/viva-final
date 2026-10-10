import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { kkcGlass } from "../fixtures/keyword-research/kkcGlass";

const dir = path.resolve(import.meta.dirname, "../fixtures/keyword-research/kkc-glass");
const load = <T>(name: string): T => JSON.parse(readFileSync(path.join(dir, name), "utf8"));
type Ranked = { domain: string; rows: Array<{ keyword: string; searchVolume: number | null; cpc: number | null; position: number; url: string }> };
type Serps = { serps: Array<{ keyword: string; location: string; organic: Array<{ position: number; domain: string }> }> };

// Guards the saved data itself, so later phases are tested against cases that really exercise them.
describe("KKC Glass fixture", () => {
  const serps = load<Serps>("serps.json").serps;
  const ranked = (domain: string) => load<Ranked>(`ranked-${domain}.json`).rows;
  const seen = new Set(serps.flatMap(serp => serp.organic.map(row => row.domain.replace(/^www\./, ""))));

  it("covers 20 Charlotte searches and 4 searches in each of 12 metros", () => {
    expect(serps.filter(serp => serp.location.startsWith("Charlotte"))).toHaveLength(20);
    expect(serps.filter(serp => !serp.location.startsWith("Charlotte"))).toHaveLength(48);
  });

  it("contains the non-contractors discovery has to reject", () => {
    for (const [domain, label] of Object.entries(kkcGlass.siteLabels)) {
      if (label !== "contractor") expect(seen, domain).toContain(domain);
    }
  });

  it("contains the benchmark gaps and the off-service keywords the service check has to block", () => {
    const argo = ranked("argowindowrepair.com").map(row => row.keyword);
    expect(argo).toContain("sliding door repair");
    expect(ranked("glasssolutionsnc.com").some(row => kkcGlass.mustNotRecommend.some(pattern => pattern.test(row.keyword)))).toBe(true);
  });

  it("shows the live KKC site has no top-10 rankings yet", () => {
    expect(ranked("kkcglass.com").every(row => row.position > 10)).toBe(true);
  });
});

describe("KKC Glass reviewed answers", () => {
  it.todo("phase 2: discovery labels every site in siteLabels the same way");
  it.todo("phase 2: discovery suggests argowindowrepair.com and myshowerdoor.com as national benchmarks");
  it.todo("phase 3: the playbook adds sliding door repair, sash repairs and window glass replacement");
  it.todo("phase 3: no windshield or auto glass keyword reaches the plan");
});
