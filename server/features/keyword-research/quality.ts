import type { RawKeywordMetrics } from "@shared/keywordResearch";
import type { KeywordMetrics } from "./dataforseo";
import { cleanKeyword } from "./keywords";

/** A keyword row after the data-quality pass: close variants merged into it and "near me" searches folded in. */
export interface QualityKeyword extends KeywordMetrics {
  /** Monthly searches for this phrase with "near me". Google answers those by location, so they count as demand here instead of being a target. */
  nearMeVolume: number | null;
  /**
   * Phrasings with identical Google Ads volume and CPC: a possible overlap (Google does not confirm grouping). They are
   * listed under this keyword with their own numbers; demand counts them once at the low end and separately at the high end.
   */
  variants: string[];
  variantMetrics?: RawKeywordMetrics[];
  nearMeMetrics?: RawKeywordMetrics[];
}

/** A phrase's own measurement, as Google Ads returned it. */
export function rawMetrics(row: KeywordMetrics): RawKeywordMetrics {
  return { measurement: row.measurement, keyword: row.keyword, searchVolume: row.searchVolume, cpc: row.cpc, competition: row.competition, lowTopOfPageBid: row.lowTopOfPageBid, highTopOfPageBid: row.highTopOfPageBid };
}

const NEAR_ME = /\b(near me|nearby|close to me|in my area)\b/g;

// Words that carry no meaning when comparing two phrasings of the same search.
const FILLER = new Set([
  "near", "me", "my", "in", "the", "a", "an", "for", "of", "to", "and", "or", "best", "top", "cheap", "affordable",
  "local", "company", "companies", "service", "services", "cost", "costs", "price", "prices", "pricing", "area",
]);

export function isNearMe(keyword: string) {
  return cleanKeyword(keyword).match(NEAR_ME) != null;
}

/** "shower door installation near me" → "shower door installation". */
export function headTerm(keyword: string) {
  return cleanKeyword(cleanKeyword(keyword).replace(NEAR_ME, " "));
}

function stem(word: string) {
  const singular = word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
  return singular.length > 5 ? singular.slice(0, 5) : singular;
}

/** The words that carry a phrase's meaning, stemmed ("shower doors" and "shower door" match). */
export function meaningStems(keyword: string) {
  const text = cleanKeyword(keyword).replace(/\ba ?c\b/g, "ac").replace(/-/g, " ");
  return new Set(text.split(" ").filter(word => word && !FILLER.has(word)).map(stem));
}

const COST_INTENT = /\b(cost|costs|price|prices|pricing|quote|quotes|estimate|estimates)\b/;
const QUESTION_INTENT = /^(how|what|why|when|where|which|who|can|does|do|is|are|should)\b/;
const BUYING_INTENT = /\b(buy|for sale|sale|store|shop|shops)\b/;
const REPAIR_INTENT = /\b(repair|repairs|repairing|fix|fixing)\b/;
const INSTALL_INTENT = /\b(install|installs|installing|installation|installer|installers|replace|replacing|replacement|replacements)\b/;

/**
 * Whether two phrasings ask for different things: a price, a question, a product to buy, or a repair rather than an
 * installation or replacement. Installation and replacement may share a search; Google's identical numbers decide.
 */
export function differentIntent(a: string, b: string) {
  const left = cleanKeyword(a);
  const right = cleanKeyword(b);
  const repairOnly = (text: string) => REPAIR_INTENT.test(text) && !INSTALL_INTENT.test(text);
  const installOnly = (text: string) => INSTALL_INTENT.test(text) && !REPAIR_INTENT.test(text);
  return COST_INTENT.test(left) !== COST_INTENT.test(right)
    || QUESTION_INTENT.test(left) !== QUESTION_INTENT.test(right)
    || BUYING_INTENT.test(left) !== BUYING_INTENT.test(right)
    || (repairOnly(left) && installOnly(right)) || (installOnly(left) && repairOnly(right));
}

/**
 * Google Ads often returns close variants ("ceiling fan repair" / "fix a ceiling fan") with identical volume and CPC,
 * which suggests one search but does not confirm it. Two rows are a possible overlap only when both numbers match
 * exactly, the wording overlaps (half the meaning words shared, or one phrase contained in the other), and they ask
 * for the same thing (see differentIntent): unrelated keywords do share numbers by coincidence.
 */
export function sameSearch(a: KeywordMetrics, b: KeywordMetrics) {
  if (a.searchVolume == null || a.cpc == null || a.searchVolume !== b.searchVolume || a.cpc !== b.cpc) return false;
  if (differentIntent(a.keyword, b.keyword)) return false;
  const left = meaningStems(a.keyword);
  const right = meaningStems(b.keyword);
  if (!left.size || !right.size) return false;
  const shared = [...left].filter(value => right.has(value)).length;
  return shared === left.size || shared === right.size || shared / new Set([...left, ...right]).size >= 0.5;
}

function shortestFirst(a: { keyword: string }, b: { keyword: string }) {
  return a.keyword.length - b.keyword.length || a.keyword.localeCompare(b.keyword);
}

/**
 * Merges each group of close variants into one phrasing: the one `priority` ranks highest (a phrase asked for by name,
 * then one naming a confirmed service), otherwise the shortest. The others are listed as its variants with their own
 * measurements kept unchanged.
 */
export function mergeCloseVariants(rows: KeywordMetrics[], priority: (keyword: string) => number = () => 0): { rows: QualityKeyword[]; merged: number } {
  const groups = new Map<string, KeywordMetrics[]>();
  for (const row of rows) {
    if (row.searchVolume == null || row.cpc == null) continue;
    const key = `${row.searchVolume}|${row.cpc}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const absorbed = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => priority(b.keyword) - priority(a.keyword) || shortestFirst(a, b));
    for (let index = 0; index < ordered.length; index += 1) {
      const row = ordered[index];
      if (absorbed.has(row.keyword)) continue;
      for (const other of ordered.slice(index + 1)) {
        if (!absorbed.has(other.keyword) && sameSearch(row, other)) absorbed.set(other.keyword, row.keyword);
      }
    }
  }

  const kept = new Map<string, QualityKeyword>();
  for (const row of rows) {
    if (!absorbed.has(row.keyword)) kept.set(row.keyword, { ...row, nearMeVolume: null, variants: [] });
  }
  const byKeyword = new Map(rows.map(row => [row.keyword, row]));
  for (const [variant, keeper] of absorbed) {
    const row = kept.get(keeper)!;
    row.variants.push(variant);
    row.variantMetrics = [...(row.variantMetrics ?? []), rawMetrics(byKeyword.get(variant)!)];
  }
  for (const row of kept.values()) {
    row.variants.sort();
    row.variantMetrics?.sort((a, b) => a.keyword.localeCompare(b.keyword));
  }
  return { rows: [...kept.values()], merged: absorbed.size };
}

/**
 * "near me" rows are never targets: their volume counts toward the plain phrase's demand, and their own measurements
 * are kept beside it. Nothing else moves: the plain phrase keeps its own CPC, bids and competition, unknown when
 * Google reported none. The plain phrase is found by name or among merged variants; when it is missing, it is added
 * with every measurement of its own unknown. A "near me" row Google grouped with the plain phrase (same numbers) is
 * the same search and adds no volume.
 */
export function foldNearMe(rows: QualityKeyword[]): { rows: QualityKeyword[]; folded: number } {
  const byKeyword = new Map(rows.filter(row => !isNearMe(row.keyword)).map(row => [row.keyword, row]));
  const keeperOf = new Map([...byKeyword.values()].flatMap(row => row.variants.map(variant => [variant, row] as const)));
  let folded = 0;
  for (const row of rows.filter(row => isNearMe(row.keyword))) {
    folded += 1;
    const head = headTerm(row.keyword);
    if (!head) continue;
    let target = byKeyword.get(head) ?? keeperOf.get(head);
    if (!target) {
      target = {
        keyword: head, searchVolume: null, cpc: null, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null,
        nearMeVolume: null, variants: [],
      };
      byKeyword.set(head, target);
    }
    // Only the near me row's own volume counts; its merged variants are the same search, and a near me row with the
    // plain phrase's exact numbers is the plain phrase's search.
    const counted = row.searchVolume != null && !(row.searchVolume === target.searchVolume && row.cpc === target.cpc);
    target.nearMeMetrics = [...(target.nearMeMetrics ?? []), { ...rawMetrics(row), counted }, ...(row.variantMetrics ?? []).map(item => ({ ...item, counted: false }))];
    if (!counted) continue;
    target.nearMeVolume = (target.nearMeVolume ?? 0) + row.searchVolume!;
  }
  return { rows: [...byKeyword.values()], folded };
}

/** Monthly searches for the keyword including its "near me" searches; null when neither is known. */
export { keywordDemand as totalDemand } from "@shared/keywordResearch";
