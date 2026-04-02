import {
  HISPANIC_FIRST_NAMES,
  HISPANIC_LAST_NAMES,
  ANGLICIZED_FIRST_NAME_MAP,
} from "./hispanicNames";

// Suffixes stripped before scoring so they don't become the "last name"
const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export interface NameScoreResult {
  normalizedName: string;
  firstName: string;
  lastName: string;
  hispanicNameScore: number;
  spanishOutreachRecommended: boolean;
  matchNotes: string[];
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  for (const known of HISPANIC_LAST_NAMES) {
    const d = editDistance(name, known);
    if (d <= threshold && (best === null || d < best.distance)) {
      best = { match: known, distance: d };
      if (d === 0) break; // exact match, can't do better
    }
  }
  return best;
}

export function scoreHispanicName(sellerName: string): NameScoreResult {
  const normalized = stripDiacritics(sellerName.trim().toLowerCase())
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
  let lastNameScore = 0;
  if (lastName) {
    if (HISPANIC_LAST_NAMES.includes(lastName)) {
      lastNameScore = 70;
    } else {
      const fuzzy = fuzzyMatchSurname(lastName);
      if (fuzzy) {
        // Exact phonetic match (distance 1) → full credit; distance 2 → partial
        lastNameScore = fuzzy.distance <= 1 ? 70 : 55;
        notes.push(
          `surname "${lastName}" fuzzy-matched "${fuzzy.match}" (edit distance ${fuzzy.distance})`,
        );
      }
    }
  }

  // ── First name scoring ───────────────────────────────────────────────────
  let firstNameScore = 0;
  if (firstName) {
    if (HISPANIC_FIRST_NAMES.includes(firstName)) {
      firstNameScore = 25;
    } else {
      // Check anglicized bridge table
      const bridgeMapped = ANGLICIZED_FIRST_NAME_MAP[firstName];
      if (bridgeMapped && HISPANIC_FIRST_NAMES.includes(bridgeMapped)) {
        firstNameScore = 25;
        notes.push(
          `first name "${firstName}" recognized as anglicized form of "${bridgeMapped}"`,
        );
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
