// Reviewed answers for KKC Glass (Matthews, NC), worked out by hand from the data in ./kkc-glass on 2026-10-10.
// Each keyword-research phase must reproduce these from the same data before it ships.
export const kkcGlass = {
  client: {
    name: "KKC Glass",
    domain: "kkcglass.com",
    trade: "glass",
    city: "Matthews",
    state: "NC",
    services: [
      "frameless shower doors", "shower door replacement", "window glass repair", "insulated glass replacement",
      "window leak repair", "sash replacement", "window hardware repair", "glass door repair", "glass railings", "commercial glass",
    ],
  },
  /** What each site found in discovery really is. Only contractors can be benchmarks. */
  siteLabels: {
    "argowindowrepair.com": "contractor",
    "myshowerdoor.com": "contractor",
    "glasssolutionsnc.com": "contractor",
    "carolinaglassreplacement.com": "contractor",
    "showerdoorsofcharlotte.com": "contractor",
    "glassdoctor.com": "franchise",
    "vigoindustries.com": "manufacturer",
    "dreamline.com": "manufacturer",
    "bascoshowerdoor.com": "manufacturer",
    "flooranddecor.com": "retailer",
    "horow.com": "retailer",
    "onedayglass.com": "retailer",
    "framelessshowerdoors.com": "retailer",
  },
  /** National benchmarks discovery should suggest. */
  expectedBenchmarks: ["argowindowrepair.com", "myshowerdoor.com"],
  /** Benchmark keywords that match KKC's services and must reach the plan. */
  expectedGapKeywords: ["sliding door repair", "sash repairs", "window glass replacement"],
  /** Benchmark keywords for services KKC does not sell; they must never reach the plan. */
  mustNotRecommend: [/windshield/, /auto glass/],
} as const;
