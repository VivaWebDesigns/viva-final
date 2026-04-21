/**
 * Shared normalization helper for all scorer-side name matching.
 * Used by hispanicNames.ts (static list), nameScore.ts (runtime sets + scorer input).
 *
 * Strip diacritics → lowercase → trim.
 * Does NOT remove non-alpha characters — callers that need that (e.g. scoreHispanicName)
 * apply their own regex after calling this.
 */
export function normalizeForScoring(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
