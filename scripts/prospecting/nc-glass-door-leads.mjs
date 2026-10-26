#!/usr/bin/env node
// Find glass and door businesses in an area with DataForSEO and score them as website prospects.
// Usage: node scripts/prospecting/nc-glass-door-leads.mjs [--area raleigh-durham] [--categories] [--budget 3]
// Reads DATAFORSEO_API_LOGIN / DATAFORSEO_API_PASSWORD from the environment or .env.local.
// API responses are cached in reports/prospecting/cache so reruns don't pay twice.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://api.dataforseo.com/v3";
const OUT_DIR = path.resolve("reports/prospecting");
const CACHE_DIR = path.join(OUT_DIR, "cache");

const AREAS = {
  "raleigh-durham": {
    circles: [
      { name: "Raleigh", lat: 35.7796, lng: -78.6382, radiusKm: 25 },
      { name: "Durham / Chapel Hill", lat: 35.96, lng: -78.95, radiusKm: 20 },
    ],
    serpLocations: ["Raleigh,North Carolina,United States", "Durham,North Carolina,United States"],
  },
};

// Google categories (DataForSEO ids) for residential and commercial glass and doors. No auto glass, no garage doors.
const CATEGORIES = [
  "glass_shop",
  "glass_repair_service",
  "glass_and_mirror_shop",
  "shower_door_shop",
  "window_installation_service",
  "door_and_window_store",
  "door_supplier",
  "window_supplier",
  "door_shop",
  "mirror_shop",
];
const TITLE_SEARCHES = ["glass", "shower door"];
const KEYWORDS = ["glass repair", "shower doors", "window glass replacement", "glass company", "glass door installation"];

const AUTO = /\bauto\b|automotive|windshield|windscreen|\bcars?\b|vehicle|\btrucks?\b|\brv\b|safelite|mobile glass/i;
const NOT_A_SITE = /(facebook|instagram|yelp|google|linktr\.ee|nextdoor|angi|homeadvisor|yellowpages|bbb|thumbtack|houzz|mapquest)\./i;
// How well a business's primary Google category fits the glass and door niche. Rows are labeled, never dropped.
function fitOf(category = "") {
  if (/garage door/i.test(category)) return "garage door";
  if (/stained glass|glass blow|glassware|glass craft|window cleaning|window tint/i.test(category)) return "off-target";
  if (/glass|glazier|mirror|shower door|window|door/i.test(category)) return "core";
  if (/roof|siding|contractor|remodel|building material|construction|handyman|deck|lumber|gutter/i.test(category)) return "contractor";
  return "off-target";
}
const FIT_ORDER = { core: 0, "garage door": 1, contractor: 2, "off-target": 3 };
const DIY_BUILDERS =new Set(["Wix", "GoDaddy", "Weebly", "Squarespace", "Duda"]);

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const areaKey = arg("area", "raleigh-durham");
const budget = Number(arg("budget", "3"));
const area = AREAS[areaKey];
if (!area) throw new Error(`Unknown area ${areaKey}. Known: ${Object.keys(AREAS).join(", ")}`);

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
const login = process.env.DATAFORSEO_API_LOGIN?.trim();
const password = process.env.DATAFORSEO_API_PASSWORD?.trim();
if (!login || !password) throw new Error("Set DATAFORSEO_API_LOGIN and DATAFORSEO_API_PASSWORD in .env.local");
const auth = "Basic " + Buffer.from(`${login}:${password}`).toString("base64");

fs.mkdirSync(CACHE_DIR, { recursive: true });
const spend = {};
let total = 0;

async function call(stage, endpoint, task) {
  const key = createHash("sha1").update(endpoint + JSON.stringify(task ?? null)).digest("hex");
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  let payload;
  if (fs.existsSync(cacheFile)) {
    payload = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } else {
    if (total >= budget) throw new Error(`Budget of $${budget} reached; stopping before ${endpoint}`);
    const res = await fetch(BASE + endpoint, {
      method: task ? "POST" : "GET",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: task ? JSON.stringify([task]) : undefined,
    });
    payload = await res.json();
    const cost = Number(payload.cost) || 0;
    spend[stage] = (spend[stage] || 0) + cost;
    total += cost;
    if (payload.status_code !== 20000) throw new Error(`${endpoint}: ${payload.status_code} ${payload.status_message}`);
    fs.writeFileSync(cacheFile, JSON.stringify(payload));
  }
  const t = payload.tasks?.[0];
  if (t?.status_code !== 20000) {
    console.warn(`  ${endpoint}: ${t?.status_code} ${t?.status_message}`);
    return null;
  }
  return t.result?.[0] ?? null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

// --categories: list the Google categories DataForSEO knows that look relevant, then exit.
if (args.includes("--categories")) {
  const res = await fetch(BASE + "/business_data/business_listings/categories", { headers: { Authorization: auth } });
  const payload = await res.json();
  const rows = payload.tasks?.[0]?.result ?? [];
  const names = rows.map((r) => (typeof r === "string" ? r : r.category_name ?? r.name ?? JSON.stringify(r)));
  console.log(names.filter((n) => /glass|mirror|door|window/i.test(n)).join("\n"));
  process.exit(0);
}

// 1. Find businesses: category search plus title search in each circle, deduped by place_id.
console.log(`Finding businesses in ${areaKey}...`);
const businesses = new Map();
for (const c of area.circles) {
  const coord = `${c.lat},${c.lng},${c.radiusKm}`;
  const searches = [{ categories: CATEGORIES }, ...TITLE_SEARCHES.map((title) => ({ title }))];
  for (const s of searches) {
    const result = await call("find businesses", "/business_data/business_listings/search/live", {
      ...s,
      location_coordinate: coord,
      limit: 1000,
    });
    for (const item of result?.items ?? []) {
      const id = item.place_id || item.cid;
      if (id && !businesses.has(id)) businesses.set(id, item);
    }
  }
}
const all = [...businesses.values()];
const kept = all.filter((b) => ![b.title, b.category, ...(b.additional_categories ?? [])].some((v) => v && AUTO.test(v)));
console.log(`  ${all.length} found, ${all.length - kept.length} auto glass removed, ${kept.length} kept`);

// 2. Map pack and organic rankings for the money keywords.
console.log("Checking rankings...");
const mapsRank = new Map(); // place_id or cid -> { keyword: rank }
const organicRank = new Map(); // domain -> { keyword: rank }
const best = (map, id, kw, rank) => {
  if (!id) return;
  const row = map.get(id) ?? {};
  if (!row[kw] || rank < row[kw]) row[kw] = rank;
  map.set(id, row);
};
for (const loc of area.serpLocations) {
  for (const kw of KEYWORDS) {
    const maps = await call("map rankings", "/serp/google/maps/live/advanced", {
      keyword: kw,
      location_name: loc,
      language_code: "en",
      depth: 20,
    });
    for (const it of maps?.items ?? []) {
      best(mapsRank, it.place_id, kw, it.rank_group);
      best(mapsRank, it.cid, kw, it.rank_group);
    }
    const organic = await call("organic rankings", "/serp/google/organic/live/advanced", {
      keyword: kw,
      location_name: loc,
      language_code: "en",
      depth: 10,
    });
    for (const it of organic?.items ?? []) if (it.type === "organic") best(organicRank, domainOf(it.url), kw, it.rank_group);
  }
}

// 3. Keyword count and estimated traffic per website (DataForSEO Labs).
const domains = [...new Set(kept.map((b) => domainOf(b.url)).filter((d) => d && !NOT_A_SITE.test(d)))];
console.log(`Checking ${domains.length} websites' keywords and traffic...`);
const labs = new Map();
await mapLimit(domains, 5, async (d) => {
  let r;
  try {
    r = await call("website keywords", "/dataforseo_labs/google/ranked_keywords/live", {
      target: d,
      location_name: "United States",
      language_code: "en",
      limit: 1,
    });
  } catch (e) {
    // Over budget: leave this site's keyword columns blank rather than losing the whole run.
    if (!String(e.message).startsWith("Budget")) throw e;
    return;
  }
  labs.set(d, { keywords: r?.total_count ?? 0, traffic: Math.round(r?.metrics?.organic?.etv ?? 0) });
});

// 4. Load each homepage ourselves (free) for site builder, https, copyright year and mobile tag.
console.log("Loading homepages...");
const sites = new Map();
await mapLimit(domains, 8, async (d) => {
  try {
    const res = await fetch(`http://${d}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36" },
    });
    const html = (await res.text()).slice(0, 500000);
    const builder =
      /wixstatic|wix\.com|_wixCss/i.test(html) ? "Wix"
      : /squarespace/i.test(html) ? "Squarespace"
      : /wsimg\.com|godaddy/i.test(html) ? "GoDaddy"
      : /weebly/i.test(html) ? "Weebly"
      : /multiscreensite|dudaone|duda/i.test(html) ? "Duda"
      : /shopify/i.test(html) ? "Shopify"
      : /wp-content|wordpress/i.test(html) ? "WordPress"
      : "Other/custom";
    const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)/gi)].map((m) => Number(m[1]));
    sites.set(d, {
      status: res.ok ? "ok" : `HTTP ${res.status}`,
      builder,
      https: res.url.startsWith("https://") ? "yes" : "no",
      copyright: years.length ? Math.max(...years) : "",
      mobile: /name=["']viewport["']/i.test(html) ? "yes" : "no",
    });
  } catch (e) {
    sites.set(d, { status: `down (${e.name === "TimeoutError" ? "timeout" : "error"})` });
  }
});

// 5. Score and write the spreadsheet.
const rows = kept.map((b) => {
  const d = domainOf(b.url);
  const realSite = d && !NOT_A_SITE.test(d);
  const maps = { ...(mapsRank.get(b.cid) ?? {}), ...(mapsRank.get(b.place_id) ?? {}) };
  const org = realSite ? organicRank.get(d) ?? {} : {};
  const bestMaps = Math.min(...Object.values(maps), Infinity);
  const bestOrg = Math.min(...Object.values(org), Infinity);
  const lab = realSite ? labs.get(d) ?? {} : {};
  const site = realSite ? sites.get(d) ?? {} : {};
  const reviews = b.rating?.votes_count ?? 0;
  const tier =
    bestMaps <= 3 ? "C"
    : reviews >= 10 && (!realSite || DIY_BUILDERS.has(site.builder) || (lab.keywords ?? 0) < 25 || site.status?.startsWith("down")) ? "A"
    : "B";
  return {
    fit: fitOf(b.category),
    tier,
    size: (lab.keywords ?? 0) > 3000 ? "large/national" : "",
    name: b.title,
    phone: b.phone ?? "",
    city: b.address_info?.city ?? "",
    category: b.category ?? "",
    other_categories: (b.additional_categories ?? []).join("; "),
    reviews,
    rating: b.rating?.value ?? "",
    photos: b.total_photos ?? "",
    claimed: b.is_claimed == null ? "" : b.is_claimed ? "yes" : "no",
    website: realSite ? b.url : b.url ? `(${d} only)` : "NONE",
    site_status: site.status ?? "",
    builder: site.builder ?? "",
    https: site.https ?? "",
    mobile_tag: site.mobile ?? "",
    copyright_year: site.copyright ?? "",
    ranked_keywords: realSite ? lab.keywords ?? "" : "",
    est_monthly_traffic: realSite ? lab.traffic ?? "" : "",
    best_map_rank: Number.isFinite(bestMaps) ? bestMaps : "not top 20",
    ...Object.fromEntries(KEYWORDS.map((k) => [`map: ${k}`, maps[k] ?? ""])),
    best_organic_rank: Number.isFinite(bestOrg) ? bestOrg : "not top 10",
    address: b.address ?? "",
    zip: b.address_info?.zip ?? "",
    google_maps: b.place_id ? `https://www.google.com/maps/place/?q=place_id:${b.place_id}` : "",
    place_id: b.place_id ?? "",
  };
});
const order = { A: 0, B: 1, C: 2 };
rows.sort((x, y) => FIT_ORDER[x.fit] - FIT_ORDER[y.fit] || order[x.tier] - order[y.tier] || y.reviews - x.reviews);

const cols = Object.keys(rows[0] ?? { tier: "" });
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const outFile = path.join(OUT_DIR, `nc-glass-door-${areaKey}.csv`);
fs.writeFileSync(outFile, [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n");

const count = (t) => rows.filter((r) => r.tier === t).length;
console.log(`\nWrote ${rows.length} businesses to ${outFile}`);
console.log(`Tiers: A ${count("A")}, B ${count("B")}, C ${count("C")}`);
const core = rows.filter((r) => r.fit === "core");
console.log(`Core glass/door: ${core.length} (A ${core.filter((r) => r.tier === "A").length}, B ${core.filter((r) => r.tier === "B").length}, C ${core.filter((r) => r.tier === "C").length})`);
console.log(`Fit: ${Object.keys(FIT_ORDER).map((f) => `${f} ${rows.filter((r) => r.fit === f).length}`).join(", ")}`);
console.log("DataForSEO spend this run (cached calls are free):");
for (const [stage, cost] of Object.entries(spend)) console.log(`  ${stage}: $${cost.toFixed(4)}`);
console.log(`  total: $${total.toFixed(4)}`);
