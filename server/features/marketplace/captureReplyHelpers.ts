import type { MarketplacePendingOutreach } from "@shared/schema";

export type MatchConfidence = "high" | "medium" | "low";
export type MatchMethod =
  | "thread_id"
  | "name_title_exact"
  | "name_title_fuzzy"
  | "none";

export type CaptureMatchResult = {
  confidence: MatchConfidence;
  method: MatchMethod;
};

type StoredContext = Pick<
  MarketplacePendingOutreach,
  "sellerFirstName" | "listingTitleNormalized" | "facebookJoinYear" | "threadIdentifier"
>;

type IncomingContext = {
  sellerFirstNameNormalized?: string | null;
  listingTitleNormalized?: string | null;
  threadIdentifier?: string | null;
};

export function scoreCaptureMatch(
  stored: StoredContext,
  incoming: IncomingContext
): CaptureMatchResult {
  const LOW: CaptureMatchResult = { confidence: "low", method: "none" };

  if (
    incoming.threadIdentifier &&
    stored.threadIdentifier &&
    incoming.threadIdentifier === stored.threadIdentifier
  ) {
    return { confidence: "high", method: "thread_id" };
  }

  const incomingName = incoming.sellerFirstNameNormalized;
  const storedName   = stored.sellerFirstName;
  const firstNameMatch = !!(incomingName && storedName && incomingName === storedName);

  if (!firstNameMatch) return LOW;

  const incomingTitle = incoming.listingTitleNormalized;
  const storedTitle   = stored.listingTitleNormalized;

  if (!incomingTitle || !storedTitle) return LOW;

  if (incomingTitle === storedTitle) {
    return { confidence: "high", method: "name_title_exact" };
  }

  if (
    storedTitle.includes(incomingTitle) ||
    incomingTitle.includes(storedTitle) ||
    wordOverlapMatch(incomingTitle, storedTitle)
  ) {
    return { confidence: "medium", method: "name_title_fuzzy" };
  }

  return LOW;
}

function wordOverlapMatch(a: string, b: string): boolean {
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  const [shorter, longer] =
    wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  if (shorter.length === 0) return false;
  const longerSet = new Set(longer);
  const matchCount = shorter.filter((w) => longerSet.has(w)).length;
  return matchCount / shorter.length >= 0.6;
}

const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;

export function extractPhoneFromText(text: string): string | null {
  const match = text.match(PHONE_RE);
  return match ? match[0] : null;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return null;
}
