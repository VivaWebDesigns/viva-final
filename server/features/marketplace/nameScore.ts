import {
  HISPANIC_FIRST_NAMES,
  HISPANIC_LAST_NAMES,
  ANGLICIZED_FIRST_NAME_MAP,
} from "./hispanicNames";
import { normalizeForScoring } from "./nameUtils";

// Suffixes stripped before scoring so they don't become the "last name"
const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

// Facebook UI labels can be accidentally extracted as names in localized pages.
const GENERIC_NON_NAME_TOKENS = new Set([
  "del",
  "detalle",
  "detalles",
  "vendedor",
  "vendedora",
]);

// Runtime sets — initialized from file constants, extended by admin additions at startup.
// Using Sets allows O(1) lookup and immediate effect without server restart.
let _lastNames: Set<string> = new Set(HISPANIC_LAST_NAMES);
let _firstNames: Set<string> = new Set(HISPANIC_FIRST_NAMES);

export function isBlockedNameToken(name: string): boolean {
  const normalized = normalizeForScoring(name)
    .replace(/[^a-z]/g, "")
    .trim();
  return GENERIC_NON_NAME_TOKENS.has(normalized);
}

/**
 * Called once at server startup (after DB is ready) to merge admin-added names
 * into the runtime sets so they survive server restart.
 */
export async function loadAdminNameAdditions(): Promise<void> {
  try {
    const { db } = await import("../../db");
    const { hispanicNameAdditions } = await import("@shared/schema");
    const rows = await db.select().from(hispanicNameAdditions);
    for (const row of rows) {
      const n = normalizeForScoring(row.name);
      if (isBlockedNameToken(n)) continue;
      if (row.type === "surname") _lastNames.add(n);
      else if (row.type === "first_name") _firstNames.add(n);
    }
    console.log(`[nameScore] loaded ${rows.length} admin name addition(s) from DB`);
  } catch (err: any) {
    console.error("[nameScore] failed to load admin name additions:", err.message);
  }
}

/**
 * Called immediately after a successful DB insert so the new name scores
 * without requiring a server restart.
 */
export function addNameToRuntime(type: "first_name" | "surname", name: string): void {
  if (isBlockedNameToken(name)) return;
  if (type === "surname") _lastNames.add(name);
  else _firstNames.add(name);
}

/** Returns true if the normalized name is already in the runtime surname set. */
export function hasSurname(name: string): boolean {
  if (isBlockedNameToken(name)) return false;
  return _lastNames.has(name);
}

/** Returns true if the normalized name is already in the runtime first name set. */
export function hasFirstName(name: string): boolean {
  if (isBlockedNameToken(name)) return false;
  return _firstNames.has(name);
}

export interface NameScoreResult {
  normalizedName: string;
  firstName: string;
  lastName: string;
  hispanicNameScore: number;
  spanishOutreachRecommended: boolean;
  matchNotes: string[];
}


// Levenshtein edit distance
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Returns the closest known surname and its edit distance, or null if none within threshold
function fuzzyMatchSurname(name: string): { match: string; distance: number } | null {
  if (!name) return null;
  // Allow 1 edit for any name; 2 edits only for names ≥ 8 chars
  const threshold = name.length >= 8 ? 2 : 1;
  let best: { match: string; distance: number } | null = null;
  for (const known of _lastNames) {
    const d = editDistance(name, known);
    if (d <= threshold && (best === null || d < best.distance)) {
      best = { match: known, distance: d };
      if (d === 0) break; // exact match, can't do better
    }
  }
  return best;
}

// Returns the closest known first name and its edit distance, or null if none within threshold
function fuzzyMatchFirstName(name: string): { match: string; distance: number } | null {
  if (!name) return null;
  // Allow 1 edit for any name; 2 edits only for names ≥ 8 chars
  const threshold = name.length >= 8 ? 2 : 1;
  let best: { match: string; distance: number } | null = null;
  for (const known of _firstNames) {
    const d = editDistance(name, known);
    if (d <= threshold && (best === null || d < best.distance)) {
      best = { match: known, distance: d };
      if (d === 0) break; // exact match, can't do better
    }
  }
  return best;
}

export function scoreHispanicName(sellerName: string): NameScoreResult {
  const normalized = normalizeForScoring(sellerName)
    .replace(/[^a-z\s]/g, "")
    .trim();

  const allTokens = normalized.split(/\s+/).filter(Boolean);

  // Strip name suffixes (jr, sr, ii, iii, iv, v) so they don't become the last name
  const tokens = allTokens.filter((t) => !NAME_SUFFIXES.has(t));

  const firstName = tokens[0] ?? "";
  let lastName = "";
  if (tokens.length >= 2) {
    lastName = tokens[tokens.length - 1];
  }

  const notes: string[] = [];

  // ── Surname scoring ──────────────────────────────────────────────────────
  // Latin naming convention commonly places both a paternal and maternal
  // surname after the given name (e.g. "Clayton Carneiro Medas"). The
  // previous code only checked the LAST token, silently skipping any
  // recognizable surname in a middle position.  We now score every non-first
  // token as a candidate and keep the highest score.
  const surnameCandidates = tokens.length >= 2 ? tokens.slice(1) : [];
  let lastNameScore = 0;
  for (const candidate of surnameCandidates) {
    if (isBlockedNameToken(candidate)) continue;
    let candidateScore = 0;
    let candidateNote: string | null = null;
    if (_lastNames.has(candidate)) {
      candidateScore = 70;
    } else {
      const fuzzy = fuzzyMatchSurname(candidate);
      if (fuzzy) {
        // Exact phonetic match (distance 1) → full credit; distance 2 → partial
        candidateScore = fuzzy.distance <= 1 ? 70 : 55;
        candidateNote = `surname "${candidate}" fuzzy-matched "${fuzzy.match}" (edit distance ${fuzzy.distance})`;
      }
    }
    if (candidateScore > lastNameScore) {
      lastNameScore = candidateScore;
      if (candidateNote) notes.push(candidateNote);
    }
  }

  // ── First name scoring ───────────────────────────────────────────────────
  let firstNameScore = 0;
  if (firstName && !isBlockedNameToken(firstName)) {
    if (_firstNames.has(firstName)) {
      firstNameScore = 25;
    } else {
      // Check anglicized bridge table
      const bridgeMapped = ANGLICIZED_FIRST_NAME_MAP[firstName];
      if (bridgeMapped && _firstNames.has(bridgeMapped)) {
        firstNameScore = 25;
        notes.push(
          `first name "${firstName}" recognized as anglicized form of "${bridgeMapped}"`,
        );
      } else {
        // Fuzzy match against known first names (same edit-distance logic as surnames)
        const fuzzyFirst = fuzzyMatchFirstName(firstName);
        if (fuzzyFirst) {
          // Distance 1 → full credit; distance 2 → partial credit
          firstNameScore = fuzzyFirst.distance <= 1 ? 25 : 15;
          notes.push(
            `first name "${firstName}" fuzzy-matched "${fuzzyFirst.match}" (edit distance ${fuzzyFirst.distance})`,
          );
        }
      }
    }
  }

  const hispanicNameScore = Math.min(100, lastNameScore + firstNameScore);
  const spanishOutreachRecommended = hispanicNameScore >= 70;

  return {
    normalizedName: tokens.join(" "),
    firstName,
    lastName,
    hispanicNameScore,
    spanishOutreachRecommended,
    matchNotes: notes,
  };
}
