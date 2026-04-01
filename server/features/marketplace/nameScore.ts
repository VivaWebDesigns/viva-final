import {
  HISPANIC_FIRST_NAMES,
  HISPANIC_LAST_NAMES,
} from "./hispanicNames";

export interface NameScoreResult {
  normalizedName: string;
  firstName: string;
  lastName: string;
  hispanicNameScore: number;
  spanishOutreachRecommended: boolean;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function scoreHispanicName(sellerName: string): NameScoreResult {
  const normalized = stripDiacritics(sellerName.trim().toLowerCase())
    .replace(/[^a-z\s]/g, "")
    .trim();

  const tokens = normalized.split(/\s+/).filter(Boolean);

  const firstName = tokens[0] ?? "";

  let lastName = "";
  if (tokens.length > 2) {
    lastName = tokens[tokens.length - 1];
  } else if (tokens.length === 2) {
    lastName = tokens[1];
  }

  const lastNameScore = lastName && HISPANIC_LAST_NAMES.includes(lastName) ? 70 : 0;
  const firstNameScore = firstName && HISPANIC_FIRST_NAMES.includes(firstName) ? 25 : 0;

  const hispanicNameScore = Math.min(100, lastNameScore + firstNameScore);
  const spanishOutreachRecommended = hispanicNameScore >= 70;

  return {
    normalizedName: tokens.join(" "),
    firstName,
    lastName,
    hispanicNameScore,
    spanishOutreachRecommended,
  };
}
