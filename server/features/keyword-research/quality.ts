import type { KeywordMetrics } from "./dataforseo";
import { cleanKeyword } from "./keywords";

/** A keyword row after the data-quality pass: close variants merged into it and "near me" searches folded in. */
export interface QualityKeyword extends KeywordMetrics {
  /** Monthly searches for this phrase with "near me". Google answers those by location, so they count as demand here instead of being a target. */
  nearMeVolume: number | null;
  /** Phrases Google reports as the same search (identical volume and CPC), merged so demand is counted once. */
  variants: string[];
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

function meaningStems(keyword: string) {
  const text = cleanKeyword(keyword).replace(/\ba ?c\b/g, "ac").replace(/-/g, " ");
  return new Set(text.split(" ").filter(word => word && !FILLER.has(word)).map(stem));
}

/**
 * Google Ads reports close variants ("ceiling fan repair" / "fix a ceiling fan") with identical volume and CPC.
 * Two rows are the same search only when both numbers match exactly AND the wording overlaps (half the meaning
 * words shared, or one phrase contained in the other): unrelated keywords do share numbers by coincidence.
 */
export function sameSearch(a: KeywordMetrics, b: KeywordMetrics) {
  if (a.searchVolume == null || a.cpc == null || a.searchVolume !== b.searchVolume || a.cpc !== b.cpc) return false;
  const left = meaningStems(a.keyword);
  const right = meaningStems(b.keyword);
  if (!left.size || !right.size) return false;
  const shared = [...left].filter(value => right.has(value)).length;
  return shared === left.size || shared === right.size || shared / new Set([...left, ...right]).size >= 0.5;
}

function shortestFirst(a: { keyword: string }, b: { keyword: string }) {
  return a.keyword.length - b.keyword.length || a.keyword.localeCompare(b.keyword);
}

/** Merges each group of close variants into its shortest phrasing; the others are listed as its variants. */
export function mergeCloseVariants(rows: KeywordMetrics[]): { rows: QualityKeyword[]; merged: number } {
  const groups = new Map<string, KeywordMetrics[]>();
  for (const row of rows) {
    if (row.searchVolume == null || row.cpc == null) continue;
    const key = `${row.searchVolume}|${row.cpc}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const absorbed = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort(shortestFirst);
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
  for (const [variant, keeper] of absorbed) kept.get(keeper)!.variants.push(variant);
  for (const row of kept.values()) row.variants.sort();
  return { rows: [...kept.values()], merged: absorbed.size };
}

/**
 * "near me" rows are never targets: their volume moves onto the plain phrase. When the plain phrase is missing,
 * it is added with unknown volume of its own. A "near me" row Google grouped with the plain phrase (same numbers)
 * is the same search and adds nothing.
 */
export function foldNearMe(rows: QualityKeyword[]): { rows: QualityKeyword[]; folded: number } {
  const byKeyword = new Map(rows.filter(row => !isNearMe(row.keyword)).map(row => [row.keyword, row]));
  let folded = 0;
  for (const row of rows.filter(row => isNearMe(row.keyword))) {
    folded += 1;
    const head = headTerm(row.keyword);
    if (!head) continue;
    const target = byKeyword.get(head);
    if (!target) {
      byKeyword.set(head, { ...row, keyword: head, searchVolume: null, nearMeVolume: row.searchVolume, variants: [] });
      continue;
    }
    if (row.searchVolume == null || (row.searchVolume === target.searchVolume && row.cpc === target.cpc)) continue;
    target.nearMeVolume = (target.nearMeVolume ?? 0) + row.searchVolume;
    target.cpc = target.cpc ?? row.cpc;
  }
  return { rows: [...byKeyword.values()], folded };
}

/** Monthly searches for the keyword including its "near me" searches; null when neither is known. */
export function totalDemand(row: { searchVolume: number | null; nearMeVolume?: number | null }) {
  if (row.searchVolume == null && row.nearMeVolume == null) return null;
  return (row.searchVolume ?? 0) + (row.nearMeVolume ?? 0);
}
